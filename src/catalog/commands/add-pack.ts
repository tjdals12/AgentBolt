import { loadConfig } from '#catalog/config/load.js';
import { parseCatalogDetail } from '#catalog/content/parse.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import { editConfigFile } from '#catalog/config/write.js';
import type { GuidelineSelection } from '#catalog/config/schema.js';

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
  private readonly _packs: string;

  constructor(options: { source: string; packs: string }) {
    this._source = options.source;
    this._packs = options.packs;
  }

  execute(projectPath: string): AddPackResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[this._source];
    if (!source) {
      throw new Error(`source '${this._source}' not found in ${configPath}`);
    }

    const packNames = this.parsePackNames();
    if (packNames.length === 0) {
      throw new Error(`no pack names given (use --packs=<name,...>)`);
    }

    const catalogDir = resolveCatalogDir(projectPath, this._source, source);
    const catalogDetail = parseCatalogDetail(catalogDir);
    const availablePacks = new Map(
      catalogDetail.map((packDetail) => [packDetail.name, packDetail]),
    );
    const existingPacks = new Set(Object.keys(config.packs[this._source] ?? {}));

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

  private parsePackNames() {
    const packs = this._packs
      .split(',')
      .map((pack) => pack.trim())
      .filter((pack) => pack.length > 0);
    return [...new Set(packs)];
  }
}
