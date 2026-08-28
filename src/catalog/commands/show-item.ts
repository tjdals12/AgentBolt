import path from 'node:path';

import type { Agent, Guideline, ItemType, Skill } from '#catalog/content/item/model.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import { loadConfig } from '#catalog/config/load.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { parseCatalogDetail } from '#catalog/content/parse.js';
import { findAgent, findGuideline, findSkill } from '#catalog/content/item/find-detail.js';
import { listAssetFiles } from '#catalog/content/item/list-assets.js';

export type ShownItem = {
  [K in ItemType]: { type: K } & { skills: Skill; agents: Agent; guidelines: Guideline }[K];
}[ItemType];

export type ShowItemResult = {
  sourceAlias: string;
  packName: string;
  items: ShownItem[];
};

export class ShowItemCommand {
  private readonly _source: string;
  private readonly _pack: string;
  private readonly _item: string;

  constructor(options: { source: string; pack: string; item: string }) {
    this._source = options.source;
    this._pack = options.pack;
    this._item = options.item;
  }

  execute(projectPath: string): ShowItemResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[this._source];
    if (!source) {
      throw new Error(`source '${this._source}' not found in ${configPath}`);
    }

    const catalogDir = resolveCatalogDir(projectPath, this._source, source);
    const catalogDetail = parseCatalogDetail(catalogDir);

    const packDetail = catalogDetail.find((pack) => pack.name === this._pack);
    if (!packDetail) {
      throw new Error(
        `unknown pack in source '${this._source}': ${this._pack}. run 'agent-bolt list-packs --source=${this._source}' to see available packs.`,
      );
    }

    const { skills, agents, guidelines } = packDetail.items;
    const inSkills = skills.some((skill) => skill.name === this._item);
    const inAgents = agents.some((agent) => agent.name === this._item);
    const inGuidelines = guidelines.some((guideline) => guideline.name === this._item);

    if (!inSkills && !inAgents && !inGuidelines) {
      throw new Error(
        `unknown item in pack '${this._pack}': ${this._item}. run 'agent-bolt list-items --source=${this._source} --packs=${this._pack}' to see available items.`,
      );
    }

    const items: ShownItem[] = [];

    if (inSkills) {
      const skill = findSkill(catalogDir, this._pack, this._item);
      if (skill) {
        const assets = listAssetFiles(skill.sourceDir, skill.assets);
        items.push({ type: 'skills', ...skill, assets });
      }
    }

    if (inAgents) {
      const agent = findAgent(catalogDir, this._pack, this._item);
      if (agent) {
        items.push({ type: 'agents', ...agent });
      }
    }

    if (inGuidelines) {
      const guideline = findGuideline(catalogDir, this._pack, this._item);
      if (guideline) {
        items.push({ type: 'guidelines', ...guideline });
      }
    }

    return {
      sourceAlias: this._source,
      packName: this._pack,
      items,
    };
  }

  toJson(result: ShowItemResult) {
    const { sourceAlias, packName, items } = result;
    return {
      source: sourceAlias,
      pack: packName,
      items: items.map((item) => {
        switch (item.type) {
          case 'skills': {
            const {
              name,
              description,
              toolConfig,
              instructions,
              instructionsPath,
              sourceDir,
              assets,
            } = item;
            return {
              type: 'skill',
              name,
              description,
              toolConfig,
              instructions,
              instructionsPath,
              assets: assets.map((asset) => ({ name: asset, path: path.join(sourceDir, asset) })),
            };
          }

          case 'agents': {
            const { name, description, toolConfig, instructions, instructionsPath } = item;
            return {
              type: 'agent',
              name,
              description,
              toolConfig,
              instructions,
              instructionsPath,
            };
          }

          case 'guidelines': {
            const { name, description, recommended, body, bodyPath } = item;
            return {
              type: 'guideline',
              name,
              description,
              recommended,
              body,
              bodyPath,
            };
          }
        }
      }),
    };
  }
}
