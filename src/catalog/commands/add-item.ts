import { checkbox, select, Separator } from '@inquirer/prompts';
import chalk from 'chalk';

import { buildCatalogConfigPath } from '#core/paths.js';
import { canPrompt } from '#core/tty.js';
import { loadConfig } from '#catalog/config/load.js';
import { editConfigFile } from '#catalog/config/write.js';
import type { Config, GuidelineSelection, PackSelection } from '#catalog/config/schema.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { ITEM_TYPES, type ItemType } from '#catalog/content/item/model.js';
import { parseCatalogDetail } from '#catalog/content/parse.js';
import { alignPackRows, pageSizeFor, truncate, visibleWidth } from '#cli/format.js';
import { itemSectionHeader } from '#cli/prompts.js';
import type { Source } from '#catalog/source/schema.js';
import type { PackDetail } from '#catalog/content/pack/model.js';
import type { ProgressReporter } from '#core/progress.js';

export type AddedItemPack = {
  packName: string;
  packCreated: boolean;
  addedItems: Record<ItemType, string[]>;
  skippedItems: Record<ItemType, string[]>;
};

export type AddedItemSourceResult = {
  sourceAlias: string;
  packs: AddedItemPack[];
};

export type AddItemResult = {
  results: AddedItemSourceResult[];
  failures: string[];
};

export class AddItemCommand {
  private readonly _source?: string;
  private readonly _pack?: string;
  private readonly _skills?: string;
  private readonly _agents?: string;
  private readonly _guidelines?: string;
  private readonly _json: boolean;

  constructor(options: {
    source?: string;
    pack?: string;
    skills?: string;
    agents?: string;
    guidelines?: string;
    json: boolean;
  }) {
    this._source = options.source;
    this._pack = options.pack;
    this._skills = options.skills;
    this._agents = options.agents;
    this._guidelines = options.guidelines;
    this._json = options.json;
  }

  async execute(projectPath: string, reporter: ProgressReporter): Promise<AddItemResult> {
    if (this._json) {
      const hasItemOptions =
        this._skills !== undefined || this._agents !== undefined || this._guidelines !== undefined;
      if (this._source === undefined || this._pack === undefined || !hasItemOptions) {
        throw new Error(
          `--source, --pack, and at least one of --skills/--agents/--guidelines are required with --json. e.g. --source=common --pack=git-workflow --skills=create-commit`,
        );
      }
    }

    if (this._source !== undefined) {
      const promptPack = this._pack === undefined;
      const promptItems =
        this._skills === undefined && this._agents === undefined && this._guidelines === undefined;

      if (promptPack && !promptItems) {
        throw new Error(
          'The --pack option is required with --skills, --agents, or --guidelines. e.g. --pack=git-workflow',
        );
      }
      if ((promptPack || promptItems) && !canPrompt()) {
        if (promptPack) {
          throw new Error(
            'The --pack option is required (or run add-item in an interactive terminal). e.g. --pack=git-workflow',
          );
        }
        throw new Error(
          'No items to add. Specify at least one of --skills, --agents, or --guidelines (or run add-item in an interactive terminal).',
        );
      }

      const optionItemsByType = promptItems
        ? undefined
        : {
            skills: this.parseItemNames(this._skills),
            agents: this.parseItemNames(this._agents),
            guidelines: this.parseItemNames(this._guidelines),
          };
      if (optionItemsByType) {
        const totalInput = ITEM_TYPES.reduce(
          (sum, type) => sum + optionItemsByType[type].length,
          0,
        );
        if (totalInput === 0) {
          throw new Error(
            'No items to add. Specify at least one of --skills, --agents, or --guidelines.',
          );
        }
      }

      const result = await this.addItemsFromSource({
        projectPath,
        sourceAlias: this._source,
        packName: this._pack,
        optionItemsByType,
        reporter,
      });
      return { results: [result], failures: [] };
    }

    if (this._pack !== undefined) {
      throw new Error('The --source option is required with --pack. e.g. --source=common');
    }
    const hasItemOptions =
      this._skills !== undefined || this._agents !== undefined || this._guidelines !== undefined;
    if (hasItemOptions) {
      throw new Error(
        'The --source option is required with --skills, --agents, or --guidelines. e.g. --source=common',
      );
    }
    if (!canPrompt()) {
      throw new Error(
        'The --source option is required (or run add-item in an interactive terminal). e.g. --source=common',
      );
    }

    const configPath = buildCatalogConfigPath(projectPath);
    const bySource = new Map<string, AddedItemSourceResult>();
    const failures: string[] = [];

    while (true) {
      const config = loadConfig(configPath);
      if (Object.keys(config.sources).length === 0) {
        throw new Error(`no sources configured. run 'agent-bolt init' to add one.`);
      }

      const sourceAlias = await this.promptSourceSelection(config.sources, bySource);
      if (sourceAlias === null) break;

      try {
        const result = await this.addItemsFromSource({
          projectPath,
          sourceAlias,
          packName: undefined,
          optionItemsByType: undefined,
          reporter,
        });
        if (result.packs.length > 0) {
          const merged = bySource.get(sourceAlias);
          if (merged) {
            for (const pack of result.packs) {
              this.mergePackInto(merged.packs, pack);
            }
          } else {
            bySource.set(sourceAlias, result);
          }
        }
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }

    return { results: [...bySource.values()], failures };
  }

  toJson(result: AddItemResult) {
    const { results, failures } = result;
    return {
      results: results.map(({ sourceAlias, packs }) => ({
        source: sourceAlias,
        packs: packs.map(({ packName, packCreated, addedItems, skippedItems }) => ({
          name: packName,
          created: packCreated,
          added: addedItems,
          skipped: skippedItems,
        })),
      })),
      failures,
    };
  }

  private async addItemsFromSource(options: {
    projectPath: string;
    sourceAlias: string;
    packName: string | undefined;
    optionItemsByType: Record<ItemType, string[]> | undefined;
    reporter: ProgressReporter;
  }): Promise<AddedItemSourceResult> {
    const { projectPath, sourceAlias, packName, optionItemsByType, reporter } = options;

    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[sourceAlias];
    if (!source) {
      throw new Error(`source '${sourceAlias}' not found in ${configPath}`);
    }

    const interactive = packName === undefined || optionItemsByType === undefined;
    const catalogDetail = this.resolveCatalogDetail(
      projectPath,
      sourceAlias,
      source,
      reporter,
      interactive,
    );

    if (packName !== undefined) {
      const packDetail = catalogDetail.find((pack) => pack.name === packName);
      if (!packDetail) {
        throw new Error(
          `unknown pack in source '${sourceAlias}': ${packName}. run 'agent-bolt list-packs --source=${sourceAlias}' to see available packs.`,
        );
      }
      const pack = await this.addItemsToPack({
        configPath,
        config,
        sourceAlias,
        packDetail,
        optionItemsByType,
      });
      return { sourceAlias, packs: [pack] };
    }

    if (catalogDetail.length === 0) {
      throw new Error(`source '${sourceAlias}' has no packs.`);
    }

    const packs: AddedItemPack[] = [];
    while (true) {
      const freshConfig = loadConfig(configPath);
      const existingPacks: Record<string, PackSelection> = freshConfig.packs[sourceAlias] ?? {};

      const hasSelectablePack = catalogDetail.some((pack) => {
        const configuredPack = existingPacks[pack.name];
        const { added, total } = this.countConfiguredItems(pack, configuredPack);
        return added < total;
      });
      if (!hasSelectablePack) {
        if (packs.length === 0) {
          console.log(chalk.dim(`  all items in source '${sourceAlias}' are already added`));
        }
        break;
      }

      const selectedPackName = await this.promptPackSelection(
        catalogDetail,
        sourceAlias,
        existingPacks,
      );
      if (selectedPackName === null) break;

      const packDetail = catalogDetail.find((pack) => pack.name === selectedPackName)!;
      const pack = await this.addItemsToPack({
        configPath,
        config: freshConfig,
        sourceAlias,
        packDetail,
        optionItemsByType: undefined,
      });
      if (this.countAddedItems(pack) > 0) {
        this.mergePackInto(packs, pack);
      }
    }

    return { sourceAlias, packs };
  }

  private mergePackInto(packs: AddedItemPack[], pack: AddedItemPack): void {
    const existing = packs.find((existingPack) => existingPack.packName === pack.packName);
    if (!existing) {
      packs.push(pack);
      return;
    }

    existing.packCreated = existing.packCreated || pack.packCreated;
    for (const itemType of ITEM_TYPES) {
      existing.addedItems[itemType].push(...pack.addedItems[itemType]);
      existing.skippedItems[itemType].push(...pack.skippedItems[itemType]);
    }
  }

  private async addItemsToPack(options: {
    configPath: string;
    config: Config;
    sourceAlias: string;
    packDetail: PackDetail;
    optionItemsByType: Record<ItemType, string[]> | undefined;
  }): Promise<AddedItemPack> {
    const { configPath, config, sourceAlias, packDetail, optionItemsByType } = options;

    const packName = packDetail.name;

    const validItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(packDetail.items.skills.map((item) => item.name)),
      agents: new Set(packDetail.items.agents.map((item) => item.name)),
      guidelines: new Set(packDetail.items.guidelines.map((item) => item.name)),
    };
    const guidelineRecommendations = new Map(
      packDetail.items.guidelines.map((guideline) => [guideline.name, guideline.recommended]),
    );

    const existingPacks = config.packs[sourceAlias];
    const existingPack = existingPacks ? existingPacks[packName] : undefined;
    const existingItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(existingPack?.skills ?? []),
      agents: new Set(existingPack?.agents ?? []),
      guidelines: new Set(Object.keys(existingPack?.guidelines ?? {})),
    };

    let inputItemsByType: Record<ItemType, string[]> | undefined = optionItemsByType;
    if (inputItemsByType === undefined) {
      inputItemsByType = await this.promptItemSelection(
        sourceAlias,
        packDetail,
        existingItemsByType,
      );
    }

    const unknownItems: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    const skippedItems: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    const addedItems: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    for (const itemType of ITEM_TYPES) {
      const inputItemNames = inputItemsByType[itemType];
      const validItemNames = validItemsByType[itemType];
      const existItemNames = existingItemsByType[itemType];
      for (const inputItemName of inputItemNames) {
        if (!validItemNames.has(inputItemName)) {
          unknownItems[itemType].push(inputItemName);
        } else if (existItemNames.has(inputItemName)) {
          skippedItems[itemType].push(inputItemName);
        } else {
          addedItems[itemType].push(inputItemName);
        }
      }
    }

    const hasUnknown = ITEM_TYPES.some((itemType) => unknownItems[itemType].length > 0);
    if (hasUnknown) {
      const lines = ITEM_TYPES.filter((itemType) => unknownItems[itemType].length > 0).map(
        (itemType) => `  ${itemType}: ${unknownItems[itemType].join(', ')}`,
      );
      throw new Error(
        [
          `unknown items in pack '${packName}':`,
          lines.join('\n'),
          `run 'agent-bolt list-items --source=${sourceAlias} --pack=${packName}' to see available items.`,
        ].join('\n'),
      );
    }

    const addedCount = ITEM_TYPES.reduce((sum, type) => sum + addedItems[type].length, 0);
    if (addedCount > 0) {
      editConfigFile(configPath, (document) => {
        const packPath = ['packs', sourceAlias, packName];
        if (existingPack) {
          for (const itemType of ITEM_TYPES) {
            const itemNames = addedItems[itemType];
            if (itemNames.length === 0) continue;

            const itemTypePath = [...packPath, itemType];

            if (itemType === 'guidelines') {
              for (const itemName of itemNames) {
                const recommended = guidelineRecommendations.get(itemName)!;
                document.setIn([...itemTypePath, itemName], document.createNode(recommended));
              }
            } else {
              const hasNode = document.hasIn(itemTypePath);
              if (!hasNode) {
                document.setIn(itemTypePath, document.createNode([]));
              }

              for (const itemName of itemNames) {
                document.addIn(itemTypePath, itemName);
              }
            }
          }
        } else {
          const { skills, agents, guidelines: guidelineNames } = addedItems;
          const guidelines: Record<string, GuidelineSelection> = {};
          guidelineNames.forEach((guidelineName) => {
            const recommended = guidelineRecommendations.get(guidelineName)!;
            guidelines[guidelineName] = recommended;
          });
          document.setIn(
            packPath,
            document.createNode({
              skills,
              agents,
              guidelines,
            }),
          );
        }
      });
    }

    return {
      packName,
      packCreated: existingPack === undefined,
      addedItems,
      skippedItems,
    };
  }

  private resolveCatalogDetail(
    projectPath: string,
    sourceAlias: string,
    source: Source,
    reporter: ProgressReporter,
    interactive: boolean,
  ): PackDetail[] {
    if (!interactive) {
      const catalogDir = resolveCatalogDir(projectPath, sourceAlias, source);
      return parseCatalogDetail(catalogDir);
    }

    reporter.start(`Resolving source '${sourceAlias}'`);
    try {
      const catalogDir = resolveCatalogDir(projectPath, sourceAlias, source);
      const catalogDetail = parseCatalogDetail(catalogDir);
      reporter.succeed(`source '${sourceAlias}'`);
      return catalogDetail;
    } catch (e) {
      reporter.stop();
      throw e;
    }
  }

  private async promptSourceSelection(
    sources: Record<string, Source>,
    bySource: Map<string, AddedItemSourceResult>,
  ): Promise<string | null> {
    const entries = Object.entries(sources);
    const aliasWidth = Math.max(0, ...entries.map(([alias]) => alias.length));

    const sourceChoices = entries.map(([alias, source]) => {
      const location = source.type === 'local' ? source.path : source.url;
      const added = bySource.get(alias);
      const addedCount = added
        ? added.packs.reduce((sum, pack) => sum + this.countAddedItems(pack), 0)
        : 0;
      const addedNote = addedCount > 0 ? chalk.dim(`  · added ${addedCount}`) : '';
      return {
        name: `${alias.padEnd(aliasWidth)}  ${chalk.dim(`(${source.type} · ${location})`)}${addedNote}`,
        value: alias,
        short: alias,
      };
    });

    return select<string | null>({
      message: 'Select a source (or finish)',
      choices: [...sourceChoices, new Separator(), { name: 'Done', value: null }],
      loop: false,
      pageSize: pageSizeFor(sourceChoices.length + 2),
    });
  }

  private countConfiguredItems(
    packDetail: PackDetail,
    existingPack: PackSelection | undefined,
  ): { added: number; total: number } {
    const existingItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(existingPack?.skills ?? []),
      agents: new Set(existingPack?.agents ?? []),
      guidelines: new Set(Object.keys(existingPack?.guidelines ?? {})),
    };
    let added = 0;
    let total = 0;
    for (const itemType of ITEM_TYPES) {
      const catalogItems = packDetail.items[itemType];
      const configuredItemNames = existingItemsByType[itemType];
      for (const item of catalogItems) {
        total += 1;
        if (configuredItemNames.has(item.name)) added += 1;
      }
    }
    return { added, total };
  }

  private async promptPackSelection(
    catalogDetail: PackDetail[],
    sourceAlias: string,
    existingPacks: Record<string, PackSelection>,
  ): Promise<string | null> {
    const rows = alignPackRows(
      catalogDetail.map((pack) => ({
        name: pack.name,
        counts: {
          skills: pack.items.skills.length,
          agents: pack.items.agents.length,
          guidelines: pack.items.guidelines.length,
        },
      })),
    );

    const packChoices = rows.map((row) => {
      const packDetail = catalogDetail.find((pack) => pack.name === row.name)!;
      const { added, total } = this.countConfiguredItems(packDetail, existingPacks[row.name]);

      let disabled: string | false = false;
      let addedNote = '';
      if (total === 0) {
        disabled = '(no items)';
      } else if (added >= total) {
        disabled = `(${added}/${total} added)`;
      } else if (added > 0) {
        addedNote = chalk.dim(`  (${added}/${total} added)`);
      }

      return {
        name: `${row.paddedName}  ${row.counts}${addedNote}`,
        value: row.name,
        short: row.name,
        disabled,
      };
    });

    return select<string | null>({
      message: `Select a pack in source '${sourceAlias}' (or finish)`,
      choices: [...packChoices, new Separator(), { name: 'Done', value: null }],
      loop: false,
      pageSize: pageSizeFor(packChoices.length + 2),
    });
  }

  private async promptItemSelection(
    sourceAlias: string,
    packDetail: PackDetail,
    existingItemsByType: Record<ItemType, Set<string>>,
  ): Promise<Record<ItemType, string[]>> {
    const empty: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };

    const nameWidth = Math.max(
      0,
      ...ITEM_TYPES.flatMap((itemType) =>
        packDetail.items[itemType].map((item) => item.name.length),
      ),
    );

    const hasSelectable = ITEM_TYPES.some((itemType) =>
      packDetail.items[itemType].some((item) => !existingItemsByType[itemType].has(item.name)),
    );
    if (!hasSelectable) {
      const totalItems = ITEM_TYPES.reduce(
        (sum, itemType) => sum + packDetail.items[itemType].length,
        0,
      );
      const note =
        totalItems === 0
          ? `pack '${packDetail.name}' has no items`
          : `all items in '${packDetail.name}' are already added`;
      console.log(chalk.dim(`  ${note}`));
      return empty;
    }

    type ItemChoice = {
      name: string;
      value: { type: ItemType; name: string };
      short: string;
      disabled: string | false;
    };
    const choices: (Separator | ItemChoice)[] = [];

    const rowWidth = Math.max(
      0,
      ...ITEM_TYPES.flatMap((itemType) =>
        packDetail.items[itemType].map(
          (item) => nameWidth + 2 + visibleWidth(truncate(item.description, 50)),
        ),
      ),
    );

    for (const itemType of ITEM_TYPES) {
      const items = packDetail.items[itemType];
      if (items.length === 0) continue;

      if (choices.length > 0) choices.push(new Separator(' '));
      choices.push(itemSectionHeader(itemType, rowWidth));

      for (const item of items) {
        const alreadyAdded = existingItemsByType[itemType].has(item.name);
        choices.push({
          name: `${item.name.padEnd(nameWidth)}  ${chalk.dim(truncate(item.description, 50))}`,
          value: { type: itemType, name: item.name },
          short: item.name,
          disabled: alreadyAdded ? '(already added)' : false,
        });
      }
    }

    const selected = await checkbox({
      message: `Select items to add to '${sourceAlias}/${packDetail.name}'`,
      choices,
      loop: false,
      pageSize: pageSizeFor(choices.length),
      theme: { icon: { disabledUnchecked: '✓' } },
    });

    const result: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    for (const { type, name } of selected) {
      result[type].push(name);
    }
    return result;
  }

  private countAddedItems(pack: AddedItemPack): number {
    return ITEM_TYPES.reduce((sum, itemType) => sum + pack.addedItems[itemType].length, 0);
  }

  private parseItemNames(value?: string) {
    if (!value) return [];
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return [...new Set(items)];
  }
}
