import { checkbox, select, Separator } from '@inquirer/prompts';
import chalk from 'chalk';

import { loadConfig } from '#catalog/config/load.js';
import { parseCatalogDetail } from '#catalog/content/parse.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import { canPrompt } from '#core/tty.js';
import { editConfigFile } from '#catalog/config/write.js';
import { alignPackRows } from '#cli/format.js';
import type { GuidelineSelection } from '#catalog/config/schema.js';
import type { Source } from '#catalog/source/schema.js';
import type { PackDetail } from '#catalog/content/pack/model.js';
import type { ProgressReporter } from '#core/progress.js';

export type AddedPack = {
  name: string;
  skills: string[];
  agents: string[];
  guidelines: Record<string, GuidelineSelection>;
};

export type AddedSourceResult = {
  sourceAlias: string;
  addedPacks: AddedPack[];
  skippedPackNames: string[];
};

export type AddPackResult = {
  results: AddedSourceResult[];
  failures: string[];
};

export class AddPackCommand {
  private readonly _source?: string;
  private readonly _packs?: string;
  private readonly _json: boolean;

  constructor(options: { source?: string; packs?: string; json: boolean }) {
    this._source = options.source;
    this._packs = options.packs;
    this._json = options.json;
  }

  async execute(projectPath: string, reporter: ProgressReporter): Promise<AddPackResult> {
    if (this._json && (this._source === undefined || this._packs === undefined)) {
      throw new Error(
        `--source and --packs are required with --json. e.g. --source=common --packs=git-workflow`,
      );
    }

    if (this._source !== undefined) {
      const { result } = await this.addPacksFromSource(projectPath, this._source, reporter);
      return { results: [result], failures: [] };
    }

    if (this._packs !== undefined) {
      throw new Error(`The --source option is required with --packs. e.g. --source=common`);
    }
    if (!canPrompt()) {
      throw new Error(
        `The --source option is required (or run add-pack in an interactive terminal). e.g. --source=common`,
      );
    }

    const configPath = buildCatalogConfigPath(projectPath);
    const bySource = new Map<string, AddedSourceResult>();
    const exhaustedSources = new Set<string>();
    const failures: string[] = [];

    while (true) {
      const config = loadConfig(configPath);
      if (Object.keys(config.sources).length === 0) {
        throw new Error(`no sources configured. run 'agent-bolt init' to add one.`);
      }

      const sourceAlias = await this.promptSourceSelection(
        config.sources,
        bySource,
        exhaustedSources,
      );
      if (sourceAlias === null) break;

      try {
        const { result, exhausted } = await this.addPacksFromSource(
          projectPath,
          sourceAlias,
          reporter,
        );
        if (exhausted) {
          exhaustedSources.add(sourceAlias);
        }
        if (result.addedPacks.length > 0) {
          const merged = bySource.get(sourceAlias);
          if (merged) {
            merged.addedPacks.push(...result.addedPacks);
            merged.skippedPackNames.push(...result.skippedPackNames);
          } else {
            bySource.set(sourceAlias, result);
          }
        }
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }

    const results = [...bySource.values()];
    return { results, failures };
  }

  toJson(result: AddPackResult) {
    const { results, failures } = result;
    return {
      results: results.map(({ sourceAlias, addedPacks, skippedPackNames }) => ({
        source: sourceAlias,
        added: addedPacks,
        skipped: skippedPackNames,
      })),
      failures,
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

  private async promptPackSelection(
    sourceAlias: string,
    catalogDetail: PackDetail[],
    existingPacks: Set<string>,
  ): Promise<string[]> {
    const hasSelectablePack = catalogDetail.some((pack) => !existingPacks.has(pack.name));
    if (!hasSelectablePack) {
      const note =
        catalogDetail.length === 0
          ? `source '${sourceAlias}' has no packs`
          : `all packs from '${sourceAlias}' are already added`;
      console.log(chalk.dim(`  ${note}`));
      return [];
    }

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

    const choices = rows.map((row) => ({
      name: `${row.paddedName}  ${row.counts}`,
      value: row.name,
      short: row.name,
      disabled: existingPacks.has(row.name) ? '(already added)' : false,
    }));

    return checkbox({
      message: `Select packs to add to '${sourceAlias}'`,
      choices,
      theme: { icon: { disabledUnchecked: '✓' } },
    });
  }

  private parsePackNames() {
    const packs = (this._packs ?? '')
      .split(',')
      .map((pack) => pack.trim())
      .filter((pack) => pack.length > 0);
    return [...new Set(packs)];
  }

  private async addPacksFromSource(
    projectPath: string,
    sourceAlias: string,
    reporter: ProgressReporter,
  ): Promise<{ result: AddedSourceResult; exhausted: boolean }> {
    const interactive = this._packs === undefined;
    if (interactive && !canPrompt()) {
      throw new Error(
        `The --packs option is required (or run add-pack in an interactive terminal). e.g. --packs=git-workflow`,
      );
    }

    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);
    const source = config.sources[sourceAlias];
    if (!source) {
      throw new Error(`source '${sourceAlias}' not found in ${configPath}`);
    }

    const catalogDetail = this.resolveCatalogDetail(
      projectPath,
      sourceAlias,
      source,
      reporter,
      interactive,
    );
    const availablePacks = new Map(catalogDetail.map((pack) => [pack.name, pack]));
    const existingPacks = new Set(Object.keys(config.packs[sourceAlias] ?? {}));

    const packNames = interactive
      ? await this.promptPackSelection(sourceAlias, catalogDetail, existingPacks)
      : this.parsePackNames();
    if (!interactive && packNames.length === 0) {
      throw new Error(`no pack names given (use --packs=<name,...>)`);
    }

    const addedPacks: AddedPack[] = [];
    const skippedPackNames: string[] = [];
    const unknownPackNames: string[] = [];
    for (const packName of packNames) {
      const pack = availablePacks.get(packName);
      if (!pack) {
        unknownPackNames.push(packName);
      } else if (existingPacks.has(packName)) {
        skippedPackNames.push(packName);
      } else {
        const guidelines: Record<string, GuidelineSelection> = {};
        pack.items.guidelines.forEach(({ name, recommended }) => {
          guidelines[name] = recommended;
        });
        addedPacks.push({
          name: packName,
          skills: pack.items.skills.map((skill) => skill.name),
          agents: pack.items.agents.map((agent) => agent.name),
          guidelines,
        });
      }
    }

    if (unknownPackNames.length > 0) {
      throw new Error(
        `unknown pack in source '${sourceAlias}': ${unknownPackNames.join(', ')}. run 'agent-bolt list-packs --source=${sourceAlias}' to see available packs.`,
      );
    }

    if (addedPacks.length > 0) {
      editConfigFile(configPath, (document) => {
        for (const pack of addedPacks) {
          document.setIn(
            ['packs', sourceAlias, pack.name],
            document.createNode({
              skills: pack.skills,
              agents: pack.agents,
              guidelines: pack.guidelines,
            }),
          );
        }
      });
    }

    const addedNames = new Set(addedPacks.map((pack) => pack.name));
    const exhausted = catalogDetail.every(
      (pack) => existingPacks.has(pack.name) || addedNames.has(pack.name),
    );

    return { result: { sourceAlias, addedPacks, skippedPackNames }, exhausted };
  }

  private async promptSourceSelection(
    sources: Record<string, Source>,
    bySource: Map<string, AddedSourceResult>,
    exhaustedSources: Set<string>,
  ): Promise<string | null> {
    const entries = Object.entries(sources);
    const aliasWidth = Math.max(0, ...entries.map(([alias]) => alias.length));

    const sourceChoices = entries.map(([alias, source]) => {
      const location = source.type === 'local' ? source.path : source.url;
      const exhausted = exhaustedSources.has(alias);
      const added = bySource.get(alias);
      const addedNote =
        !exhausted && added ? chalk.dim(`  · added ${added.addedPacks.length}`) : '';
      return {
        name: `${alias.padEnd(aliasWidth)}  ${chalk.dim(`(${source.type} · ${location})`)}${addedNote}`,
        value: alias,
        short: alias,
        disabled: exhausted ? '(nothing to add)' : false,
      };
    });

    return select<string | null>({
      message: 'Select a source (or finish)',
      choices: [...sourceChoices, new Separator(), { name: 'Done', value: null }],
    });
  }
}
