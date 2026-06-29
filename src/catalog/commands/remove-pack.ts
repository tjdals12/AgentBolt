import { checkbox } from '@inquirer/prompts';
import { isMap } from 'yaml';

import { loadConfig } from '#catalog/config/load.js';
import type { PackSelection } from '#catalog/config/schema.js';
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

export type RemovePackResult = {
  sourceAlias: string;
  removedPacks: RemovedPack[];
  skippedPackNames: string[];
};

export class RemovePackCommand {
  private readonly _source: string;
  private readonly _packs?: string;

  constructor(options: { source: string; packs?: string }) {
    this._source = options.source;
    this._packs = options.packs;
  }

  async execute(projectPath: string): Promise<RemovePackResult> {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[this._source];
    if (!source) {
      const hasOrphanedPacks = Object.hasOwn(config.packs, this._source);
      if (hasOrphanedPacks) {
        throw new Error(
          `source '${this._source}' not found in ${configPath}, but it has orphaned packs. Run 'agent-bolt init' to clean them up.`,
        );
      }
      throw new Error(`source '${this._source}' not found in ${configPath}`);
    }

    const interactive = this._packs === undefined;
    if (interactive && !canPrompt()) {
      throw new Error(
        `The --packs option is required (or run remove-pack in an interactive terminal). e.g. --packs=git-workflow`,
      );
    }

    const existingPacks = new Map<string, PackSelection>(
      Object.entries(config.packs[this._source] ?? {}),
    );

    const packNames = interactive
      ? await this.promptPackSelection(existingPacks)
      : this.parsePackNames();

    if (!interactive && packNames.length === 0) {
      throw new Error(`no pack names given (use --packs=<name,...>)`);
    }

    const removedPacks: RemovedPack[] = [];
    const skippedPackNames: string[] = [];
    for (const packName of packNames) {
      if (existingPacks.has(packName)) {
        const pack = existingPacks.get(packName)!;
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
          document.deleteIn(['packs', this._source, pack.name]);
        }

        const sourceNode: unknown = document.getIn(['packs', this._source]);
        if (isMap(sourceNode) && sourceNode.items.length === 0) {
          document.deleteIn(['packs', this._source]);
        }
      });
    }

    return {
      sourceAlias: this._source,
      removedPacks,
      skippedPackNames,
    };
  }

  private async promptPackSelection(existingPacks: Map<string, PackSelection>): Promise<string[]> {
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
      message: `Select packs to remove from '${this._source}'`,
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
