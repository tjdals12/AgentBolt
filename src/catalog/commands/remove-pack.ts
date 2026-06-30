import { checkbox, select, Separator } from '@inquirer/prompts';
import { isMap } from 'yaml';
import chalk from 'chalk';

import { loadConfig } from '#catalog/config/load.js';
import type { Config, PackSelection } from '#catalog/config/schema.js';
import { editConfigFile } from '#catalog/config/write.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import { canPrompt } from '#core/tty.js';
import { alignPackRows } from '#cli/format.js';

export type RemovedPack = {
  name: string;
  skills: string[];
  agents: string[];
  guidelines: string[];
};

export type RemovedSourceResult = {
  sourceAlias: string;
  removedPacks: RemovedPack[];
  skippedPackNames: string[];
};

export type RemovePackResult = RemovedSourceResult[];

export class RemovePackCommand {
  private readonly _source?: string;
  private readonly _packs?: string;

  constructor(options: { source?: string; packs?: string }) {
    this._source = options.source;
    this._packs = options.packs;
  }

  async execute(projectPath: string): Promise<RemovePackResult> {
    if (this._source !== undefined) {
      const result = await this.removePacksFromSource(projectPath, this._source);
      return [result];
    }

    if (this._packs !== undefined) {
      throw new Error(`The --source option is required with --packs. e.g. --source=common`);
    }
    if (!canPrompt()) {
      throw new Error(
        `The --source option is required (or run remove-pack in an interactive terminal). e.g. --source=common`,
      );
    }

    const configPath = buildCatalogConfigPath(projectPath);
    const bySource = new Map<string, RemovedSourceResult>();

    while (true) {
      const config = loadConfig(configPath);
      if (Object.keys(config.sources).length === 0) {
        throw new Error(`no sources configured. run 'agent-bolt init' to add one.`);
      }

      const sourceAlias = await this.promptSourceSelection(config, bySource);
      if (sourceAlias === null) break;

      const result = await this.removePacksFromSource(projectPath, sourceAlias);
      if (result.removedPacks.length > 0) {
        const merged = bySource.get(sourceAlias);
        if (merged) {
          merged.removedPacks.push(...result.removedPacks);
          merged.skippedPackNames.push(...result.skippedPackNames);
        } else {
          bySource.set(sourceAlias, result);
        }
      }
    }

    const results = [...bySource.values()];
    return results;
  }

  private async removePacksFromSource(
    projectPath: string,
    sourceAlias: string,
  ): Promise<RemovedSourceResult> {
    const interactive = this._packs === undefined;
    if (interactive && !canPrompt()) {
      throw new Error(
        `The --packs option is required (or run remove-pack in an interactive terminal). e.g. --packs=git-workflow`,
      );
    }

    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[sourceAlias];
    if (!source) {
      const hasOrphanedPacks = Object.hasOwn(config.packs, sourceAlias);
      if (hasOrphanedPacks) {
        throw new Error(
          `source '${sourceAlias}' not found in ${configPath}, but it has orphaned packs. Run 'agent-bolt init' to clean them up.`,
        );
      }
      throw new Error(`source '${sourceAlias}' not found in ${configPath}`);
    }

    const existingPacks = new Map<string, PackSelection>(
      Object.entries(config.packs[sourceAlias] ?? {}),
    );

    const packNames = interactive
      ? await this.promptPackSelection(sourceAlias, existingPacks)
      : this.parsePackNames();

    if (!interactive && packNames.length === 0) {
      throw new Error(`no pack names given (use --packs=<name,...>)`);
    }

    const removedPacks: RemovedPack[] = [];
    const skippedPackNames: string[] = [];
    for (const packName of packNames) {
      const pack = existingPacks.get(packName);
      if (pack) {
        removedPacks.push({
          name: packName,
          skills: pack.skills,
          agents: pack.agents,
          guidelines: Object.keys(pack.guidelines),
        });
      } else {
        skippedPackNames.push(packName);
      }
    }

    if (removedPacks.length > 0) {
      editConfigFile(configPath, (document) => {
        for (const pack of removedPacks) {
          document.deleteIn(['packs', sourceAlias, pack.name]);
        }

        const sourceNode: unknown = document.getIn(['packs', sourceAlias]);
        if (isMap(sourceNode) && sourceNode.items.length === 0) {
          document.deleteIn(['packs', sourceAlias]);
        }
      });
    }

    return {
      sourceAlias,
      removedPacks,
      skippedPackNames,
    };
  }

  private async promptSourceSelection(
    config: Config,
    bySource: Map<string, RemovedSourceResult>,
  ): Promise<string | null> {
    const entries = Object.entries(config.sources);
    const aliasWidth = Math.max(0, ...entries.map(([alias]) => alias.length));

    const sourceChoices = entries.map(([alias, source]) => {
      const location = source.type === 'local' ? source.path : source.url;
      const hasPacks = Object.keys(config.packs[alias] ?? {}).length > 0;
      const removed = bySource.get(alias);
      const removedNote =
        hasPacks && removed ? chalk.dim(`  · removed ${removed.removedPacks.length}`) : '';
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
    });
  }

  private async promptPackSelection(
    sourceAlias: string,
    existingPacks: Map<string, PackSelection>,
  ): Promise<string[]> {
    if (existingPacks.size === 0) {
      return [];
    }

    const rows = alignPackRows(
      [...existingPacks.entries()].map(([name, pack]) => ({
        name,
        counts: {
          skills: pack.skills.length,
          agents: pack.agents.length,
          guidelines: Object.keys(pack.guidelines).length,
        },
      })),
    );

    const choices = rows.map((row) => ({
      name: `${row.paddedName}  ${row.counts}`,
      value: row.name,
      short: row.name,
    }));

    return checkbox({
      message: `Select packs to remove from '${sourceAlias}'`,
      choices,
    });
  }

  private parsePackNames() {
    const packs = (this._packs ?? '')
      .split(',')
      .map((pack) => pack.trim())
      .filter((pack) => pack.length > 0);
    return [...new Set(packs)];
  }
}
