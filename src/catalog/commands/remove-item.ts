import { isMap, isSeq } from 'yaml';

import { loadConfig } from '#catalog/config/load.js';
import { editConfigFile } from '#catalog/config/write.js';
import { ITEM_TYPES, type ItemType } from '#catalog/content/item/model.js';
import { buildCatalogConfigPath } from '#core/paths.js';

export type RemoveItemResult = {
  sourceAlias: string;
  packName: string;
  packPruned: boolean;
  removedItems: Record<ItemType, string[]>;
  skippedItems: Record<ItemType, string[]>;
};

export class RemoveItemCommand {
  private readonly _source: string;
  private readonly _pack: string;
  private readonly _skills?: string;
  private readonly _agents?: string;
  private readonly _guidelines?: string;

  constructor(options: {
    source: string;
    pack: string;
    skills?: string;
    agents?: string;
    guidelines?: string;
  }) {
    this._source = options.source;
    this._pack = options.pack;
    this._skills = options.skills;
    this._agents = options.agents;
    this._guidelines = options.guidelines;
  }

  execute(projectPath: string): RemoveItemResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[this._source];
    if (!source) {
      const packs = config.packs[this._source];
      if (packs) {
        throw new Error(
          `source '${this._source}' not found in ${configPath}, but it has orphaned packs. Run 'agent-bolt init' to clean them up`,
        );
      }
      throw new Error(`source '${this._source}' not found in ${configPath}`);
    }

    const inputItemsByType: Record<ItemType, string[]> = {
      skills: this.parseItemList(this._skills),
      agents: this.parseItemList(this._agents),
      guidelines: this.parseItemList(this._guidelines),
    };
    const totalInput = ITEM_TYPES.reduce((sum, type) => sum + inputItemsByType[type].length, 0);
    if (totalInput === 0) {
      throw new Error(
        'No items to remove. Specify at least one of --skills, --agents, --guidelines.',
      );
    }

    const existingPacks = config.packs[this._source];
    const existingPack = existingPacks ? existingPacks[this._pack] : undefined;
    const existingItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(existingPack?.skills ?? []),
      agents: new Set(existingPack?.agents ?? []),
      guidelines: new Set(Object.keys(existingPack?.guidelines ?? {})),
    };

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
        const sourcePath = ['packs', this._source];
        const packPath = [...sourcePath, this._pack];

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
      sourceAlias: this._source,
      packName: this._pack,
      packPruned,
      removedItems,
      skippedItems,
    };
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
