import { checkbox } from '@inquirer/prompts';

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

export type AddPackResult = {
  sourceAlias: string;
  addedPacks: AddedPack[];
  skippedPackNames: string[];
};

export class AddPackCommand {
  private readonly _source: string;
  private readonly _packs?: string;

  constructor(options: { source: string; packs?: string }) {
    this._source = options.source;
    this._packs = options.packs;
  }

  async execute(projectPath: string, reporter: ProgressReporter): Promise<AddPackResult> {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[this._source];
    if (!source) {
      throw new Error(`source '${this._source}' not found in ${configPath}`);
    }

    const interactive = this._packs === undefined;
    if (interactive && !canPrompt()) {
      throw new Error(
        `The --packs option is required (or run add-pack in an interactive terminal). e.g. --packs=git-workflow`,
      );
    }

    const catalogDetail = this.resolveCatalogDetail(projectPath, source, reporter, interactive);
    const availablePacks = new Map(
      catalogDetail.map((packDetail) => [packDetail.name, packDetail]),
    );
    const existingPacks = new Set(Object.keys(config.packs[this._source] ?? {}));

    const packNames = interactive
      ? await this.promptPackSelection(catalogDetail, existingPacks)
      : this.parsePackNames();

    if (!interactive && packNames.length === 0) {
      throw new Error(`no pack names given (use --packs=<name,...>)`);
    }

    const addedPackNames: string[] = [];
    const skippedPackNames: string[] = [];
    const unknownPackNames: string[] = [];
    for (const packName of packNames) {
      if (availablePacks.has(packName)) {
        if (existingPacks.has(packName)) {
          skippedPackNames.push(packName);
        } else {
          addedPackNames.push(packName);
        }
      } else {
        unknownPackNames.push(packName);
      }
    }

    if (unknownPackNames.length > 0) {
      throw new Error(
        `unknown pack in source '${this._source}': ${unknownPackNames.join(', ')}. run 'agent-bolt list-packs --source=${this._source}' to see available packs.`,
      );
    }

    const addedPacks = addedPackNames.map<AddedPack>((packName) => {
      const pack = availablePacks.get(packName)!;
      const items = pack.items;
      const skills = items.skills.map((skill) => skill.name);
      const agents = items.agents.map((agent) => agent.name);
      const guidelines: Record<string, GuidelineSelection> = {};
      items.guidelines.forEach(({ name, recommended }) => {
        guidelines[name] = recommended;
      });
      return {
        name: packName,
        skills,
        agents,
        guidelines,
      };
    });

    if (addedPacks.length > 0) {
      editConfigFile(configPath, (document) => {
        for (const pack of addedPacks) {
          const { name, skills, agents, guidelines } = pack;
          document.setIn(
            ['packs', this._source, name],
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
      sourceAlias: this._source,
      addedPacks: addedPacks,
      skippedPackNames: skippedPackNames,
    };
  }

  private resolveCatalogDetail(
    projectPath: string,
    source: Source,
    reporter: ProgressReporter,
    interactive: boolean,
  ): PackDetail[] {
    if (!interactive) {
      const catalogDir = resolveCatalogDir(projectPath, this._source, source);
      return parseCatalogDetail(catalogDir);
    }

    reporter.start(`Resolving source '${this._source}'`);
    try {
      const catalogDir = resolveCatalogDir(projectPath, this._source, source);
      const catalogDetail = parseCatalogDetail(catalogDir);
      reporter.succeed(`source '${this._source}'`);
      return catalogDetail;
    } catch (e) {
      reporter.stop();
      throw e;
    }
  }

  private async promptPackSelection(
    catalogDetail: PackDetail[],
    existingPacks: Set<string>,
  ): Promise<string[]> {
    if (catalogDetail.length === 0) {
      throw new Error(`source '${this._source}' has no packs to add.`);
    }

    const hasSelectablePack = catalogDetail.some((pack) => !existingPacks.has(pack.name));
    if (!hasSelectablePack) {
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
      message: `Select packs to add to '${this._source}'`,
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
}
