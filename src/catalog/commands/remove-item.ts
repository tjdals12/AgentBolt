import { checkbox, select, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { isMap, isSeq } from 'yaml';

import { loadConfig } from '#catalog/config/load.js';
import type { Config, PackSelection } from '#catalog/config/schema.js';
import { editConfigFile } from '#catalog/config/write.js';
import { ITEM_TYPES, type ItemType } from '#catalog/content/item/model.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import { canPrompt } from '#core/tty.js';
import { alignPackRows, pageSizeFor } from '#cli/format.js';
import { itemSectionHeader } from '#cli/prompts.js';

export type RemovedItemPack = {
  packName: string;
  packPruned: boolean;
  removedItems: Record<ItemType, string[]>;
  skippedItems: Record<ItemType, string[]>;
};

export type RemovedItemSourceResult = {
  sourceAlias: string;
  packs: RemovedItemPack[];
};

export type RemoveItemResult = {
  results: RemovedItemSourceResult[];
  failures: string[];
};

export class RemoveItemCommand {
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

  async execute(projectPath: string): Promise<RemoveItemResult> {
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
            'The --pack option is required (or run remove-item in an interactive terminal). e.g. --pack=git-workflow',
          );
        }
        throw new Error(
          'No items to remove. Specify at least one of --skills, --agents, --guidelines (or run remove-item in an interactive terminal).',
        );
      }

      const optionItemsByType = promptItems
        ? undefined
        : {
            skills: this.parseItemList(this._skills),
            agents: this.parseItemList(this._agents),
            guidelines: this.parseItemList(this._guidelines),
          };
      if (optionItemsByType) {
        const totalInput = ITEM_TYPES.reduce(
          (sum, type) => sum + optionItemsByType[type].length,
          0,
        );
        if (totalInput === 0) {
          throw new Error(
            'No items to remove. Specify at least one of --skills, --agents, --guidelines.',
          );
        }
      }

      const result = await this.removeItemsFromSource({
        projectPath,
        sourceAlias: this._source,
        packName: this._pack,
        optionItemsByType,
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
        'The --source option is required (or run remove-item in an interactive terminal). e.g. --source=common',
      );
    }

    const configPath = buildCatalogConfigPath(projectPath);
    const bySource = new Map<string, RemovedItemSourceResult>();
    const failures: string[] = [];

    while (true) {
      const config = loadConfig(configPath);
      if (Object.keys(config.sources).length === 0) {
        throw new Error(`no sources configured. run 'agent-bolt init' to add one.`);
      }

      const sourceAlias = await this.promptSourceSelection(config, bySource);
      if (sourceAlias === null) break;

      try {
        const result = await this.removeItemsFromSource({
          projectPath,
          sourceAlias,
          packName: undefined,
          optionItemsByType: undefined,
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

  toJson(result: RemoveItemResult) {
    const { results, failures } = result;
    return {
      results: results.map(({ sourceAlias, packs }) => ({
        source: sourceAlias,
        packs: packs.map(({ packName, packPruned, removedItems, skippedItems }) => ({
          name: packName,
          pruned: packPruned,
          removed: removedItems,
          skipped: skippedItems,
        })),
      })),
      failures,
    };
  }

  private async removeItemsFromSource(options: {
    projectPath: string;
    sourceAlias: string;
    packName: string | undefined;
    optionItemsByType: Record<ItemType, string[]> | undefined;
  }): Promise<RemovedItemSourceResult> {
    const { projectPath, sourceAlias, packName, optionItemsByType } = options;

    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[sourceAlias];
    if (!source) {
      const packs = config.packs[sourceAlias];
      if (packs) {
        throw new Error(
          `source '${sourceAlias}' not found in ${configPath}, but it has orphaned packs. Run 'agent-bolt init' to clean them up`,
        );
      }
      throw new Error(`source '${sourceAlias}' not found in ${configPath}`);
    }

    if (packName !== undefined) {
      const pack = await this.removeItemsFromPack({
        configPath,
        config,
        sourceAlias,
        packName,
        optionItemsByType,
      });
      return { sourceAlias, packs: [pack] };
    }

    if (!config.packs[sourceAlias] || Object.keys(config.packs[sourceAlias]).length === 0) {
      throw new Error(`source '${sourceAlias}' has no packs to remove from.`);
    }

    const packs: RemovedItemPack[] = [];
    while (true) {
      const freshConfig = loadConfig(configPath);
      const freshPacks = freshConfig.packs[sourceAlias];
      if (!freshPacks || Object.keys(freshPacks).length === 0) break;

      const removedByPack = new Map<string, number>();
      for (const removedPack of packs) {
        const prev = removedByPack.get(removedPack.packName) ?? 0;
        removedByPack.set(removedPack.packName, prev + this.countRemovedItems(removedPack));
      }

      const nextPackName = await this.promptPackSelection(sourceAlias, freshPacks, removedByPack);
      if (nextPackName === null) break;

      const pack = await this.removeItemsFromPack({
        configPath,
        config: freshConfig,
        sourceAlias,
        packName: nextPackName,
        optionItemsByType: undefined,
      });
      if (this.countRemovedItems(pack) > 0) {
        this.mergePackInto(packs, pack);
      }
    }

    return { sourceAlias, packs };
  }

  private countRemovedItems(pack: RemovedItemPack): number {
    return ITEM_TYPES.reduce((sum, itemType) => sum + pack.removedItems[itemType].length, 0);
  }

  private mergePackInto(packs: RemovedItemPack[], pack: RemovedItemPack): void {
    const existing = packs.find((existingPack) => existingPack.packName === pack.packName);
    if (!existing) {
      packs.push(pack);
      return;
    }

    existing.packPruned = existing.packPruned || pack.packPruned;
    for (const itemType of ITEM_TYPES) {
      existing.removedItems[itemType].push(...pack.removedItems[itemType]);
      existing.skippedItems[itemType].push(...pack.skippedItems[itemType]);
    }
  }

  private async removeItemsFromPack(options: {
    configPath: string;
    config: Config;
    sourceAlias: string;
    packName: string;
    optionItemsByType: Record<ItemType, string[]> | undefined;
  }): Promise<RemovedItemPack> {
    const { configPath, config, sourceAlias, packName, optionItemsByType } = options;

    const existingPacks = config.packs[sourceAlias];
    const existingPack = existingPacks ? existingPacks[packName] : undefined;
    const existingItemNamesByType: Record<ItemType, string[]> = {
      skills: existingPack?.skills ?? [],
      agents: existingPack?.agents ?? [],
      guidelines: Object.keys(existingPack?.guidelines ?? {}),
    };
    const existingItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(existingItemNamesByType.skills),
      agents: new Set(existingItemNamesByType.agents),
      guidelines: new Set(existingItemNamesByType.guidelines),
    };

    let inputItemsByType: Record<ItemType, string[]> | undefined = optionItemsByType;
    if (inputItemsByType === undefined) {
      inputItemsByType = await this.promptItemSelection(
        sourceAlias,
        packName,
        existingItemNamesByType,
      );
    }

    const removedItems: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    const skippedItems: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    for (const itemType of ITEM_TYPES) {
      const inputItemNames = inputItemsByType[itemType];
      const existingItemNames = existingItemsByType[itemType];
      for (const inputItemName of inputItemNames) {
        if (existingItemNames.has(inputItemName)) {
          removedItems[itemType].push(inputItemName);
        } else {
          skippedItems[itemType].push(inputItemName);
        }
      }
    }

    const removedCount = ITEM_TYPES.reduce((sum, type) => sum + removedItems[type].length, 0);
    let packPruned = false;

    if (removedCount > 0) {
      editConfigFile(configPath, (document) => {
        const sourcePath = ['packs', sourceAlias];
        const packPath = [...sourcePath, packName];

        for (const itemType of ITEM_TYPES) {
          const removedItemNames = new Set(removedItems[itemType]);
          if (removedItemNames.size === 0) continue;

          const itemTypePath = [...packPath, itemType];

          if (itemType === 'guidelines') {
            for (const removedItemName of removedItemNames) {
              document.deleteIn([...itemTypePath, removedItemName]);
            }
          } else {
            const existingItemNames = existingItemsByType[itemType];

            const remaining: string[] = [];
            existingItemNames.forEach((existingItemName) => {
              if (!removedItemNames.has(existingItemName)) {
                remaining.push(existingItemName);
              }
            });

            document.setIn(itemTypePath, document.createNode(remaining));
          }
        }

        for (const itemType of ITEM_TYPES) {
          const typeNode: unknown = document.getIn([...packPath, itemType]);
          if ((isSeq(typeNode) || isMap(typeNode)) && typeNode.items.length === 0) {
            document.deleteIn([...packPath, itemType]);
          }
        }

        const packNode: unknown = document.getIn(packPath);
        if (isMap(packNode) && packNode.items.length === 0) {
          document.deleteIn(packPath);
          packPruned = true;
        }

        const sourceNode: unknown = document.getIn(sourcePath);
        if (isMap(sourceNode) && sourceNode.items.length === 0) {
          document.deleteIn(sourcePath);
        }
      });
    }

    return {
      packName,
      packPruned,
      removedItems,
      skippedItems,
    };
  }

  private async promptSourceSelection(
    config: Config,
    bySource: Map<string, RemovedItemSourceResult>,
  ): Promise<string | null> {
    const entries = Object.entries(config.sources);
    const aliasWidth = Math.max(0, ...entries.map(([alias]) => alias.length));

    const sourceChoices = entries.map(([alias, source]) => {
      const location = source.type === 'local' ? source.path : source.url;
      const hasPacks = Object.keys(config.packs[alias] ?? {}).length > 0;
      const removed = bySource.get(alias);
      const removedCount = removed
        ? removed.packs.reduce((sum, pack) => sum + this.countRemovedItems(pack), 0)
        : 0;
      const removedNote =
        hasPacks && removedCount > 0 ? chalk.dim(`  · removed ${removedCount}`) : '';
      return {
        name: `${alias.padEnd(aliasWidth)}  ${chalk.dim(`(${source.type} · ${location})`)}${removedNote}`,
        value: alias,
        short: alias,
        disabled: hasPacks ? false : '(nothing to remove)',
      };
    });

    return select<string | null>({
      message: 'Select a source (or finish)',
      choices: [...sourceChoices, new Separator(), { name: 'Done', value: null }],
      loop: false,
      pageSize: pageSizeFor(sourceChoices.length + 2),
    });
  }

  private async promptPackSelection(
    sourceAlias: string,
    existingPacks: Record<string, PackSelection>,
    removedByPack: Map<string, number>,
  ): Promise<string | null> {
    const rows = alignPackRows(
      Object.entries(existingPacks).map(([name, pack]) => ({
        name,
        counts: {
          skills: pack.skills.length,
          agents: pack.agents.length,
          guidelines: Object.keys(pack.guidelines).length,
        },
      })),
    );

    const packChoices = rows.map((row) => {
      const removed = removedByPack.get(row.name) ?? 0;
      const removedNote = removed > 0 ? chalk.dim(`  · removed ${removed}`) : '';
      return {
        name: `${row.paddedName}  ${row.counts}${removedNote}`,
        value: row.name,
        short: row.name,
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
    packName: string,
    existingItemNamesByType: Record<ItemType, string[]>,
  ): Promise<Record<ItemType, string[]>> {
    const empty: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };

    const totalItems = ITEM_TYPES.reduce(
      (sum, itemType) => sum + existingItemNamesByType[itemType].length,
      0,
    );
    if (totalItems === 0) {
      console.log(chalk.dim(`  pack '${packName}' has no items to remove`));
      return empty;
    }

    const rowWidth = Math.max(
      0,
      ...ITEM_TYPES.flatMap((itemType) =>
        existingItemNamesByType[itemType].map((name) => name.length),
      ),
    );

    type ItemChoice = { name: string; value: { type: ItemType; name: string }; short: string };
    const choices: (Separator | ItemChoice)[] = [];
    for (const itemType of ITEM_TYPES) {
      const names = existingItemNamesByType[itemType];
      if (names.length === 0) continue;

      if (choices.length > 0) choices.push(new Separator(' '));
      choices.push(itemSectionHeader(itemType, rowWidth));

      for (const name of names) {
        choices.push({ name, value: { type: itemType, name }, short: name });
      }
    }

    const selected = await checkbox({
      message: `Select items to remove from '${sourceAlias}/${packName}'`,
      choices,
      loop: false,
      pageSize: pageSizeFor(choices.length),
    });

    const result: Record<ItemType, string[]> = { skills: [], agents: [], guidelines: [] };
    for (const { type, name } of selected) {
      result[type].push(name);
    }
    return result;
  }

  private parseItemList(value?: string): string[] {
    if (!value) return [];
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return [...new Set(items)];
  }
}
