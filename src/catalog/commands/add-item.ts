import { buildCatalogConfigPath } from '#core/paths.js';
import { loadConfig } from '#catalog/config/load.js';
import { editConfigFile } from '#catalog/config/write.js';
import type { GuidelineSelection } from '#catalog/config/schema.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { ITEM_TYPES, type ItemType } from '#catalog/content/item/model.js';
import { parseCatalogDetail } from '#catalog/content/parse.js';

export type AddItemResult = {
  sourceAlias: string;
  packName: string;
  packCreated: boolean;
  addedItems: Record<ItemType, string[]>;
  skippedItems: Record<ItemType, string[]>;
};

export class AddItemCommand {
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

  execute(projectPath: string): AddItemResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const source = config.sources[this._source];
    if (!source) {
      throw new Error(`source '${this._source}' not found in ${configPath}`);
    }

    const inputItemsByType: Record<ItemType, string[]> = {
      skills: this.parseItemNames(this._skills),
      agents: this.parseItemNames(this._agents),
      guidelines: this.parseItemNames(this._guidelines),
    };

    const totalInput = ITEM_TYPES.reduce((sum, type) => sum + inputItemsByType[type].length, 0);
    if (totalInput === 0) {
      throw new Error(
        'No items to add. Specify at least one of --skills, --agents, or --guidelines.',
      );
    }

    const catalogDir = resolveCatalogDir(projectPath, this._source, source);
    const catalogDetail = parseCatalogDetail(catalogDir);

    const packDetail = catalogDetail.find((packDetail) => packDetail.name === this._pack);
    if (!packDetail) {
      throw new Error(
        `unknown pack in source '${this._source}': ${this._pack}. run 'agent-bolt list-packs --source=${this._source}' to see available packs.`,
      );
    }

    const validItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(packDetail.items.skills.map((item) => item.name)),
      agents: new Set(packDetail.items.agents.map((item) => item.name)),
      guidelines: new Set(packDetail.items.guidelines.map((item) => item.name)),
    };
    const guidelineRecommendations = new Map(
      packDetail.items.guidelines.map((guideline) => [guideline.name, guideline.recommended]),
    );

    const existingPacks = config.packs[this._source];
    const existingPack = existingPacks ? existingPacks[this._pack] : undefined;
    const existingItemsByType: Record<ItemType, Set<string>> = {
      skills: new Set(existingPack?.skills ?? []),
      agents: new Set(existingPack?.agents ?? []),
      guidelines: new Set(Object.keys(existingPack?.guidelines ?? {})),
    };

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
          `unknown items in pack '${this._pack}':`,
          lines.join('\n'),
          `run 'agent-bolt list-items --source=${this._source} --pack=${this._pack}' to see available items.`,
        ].join('\n'),
      );
    }

    const addedCount = ITEM_TYPES.reduce((sum, type) => sum + addedItems[type].length, 0);
    if (addedCount > 0) {
      editConfigFile(configPath, (document) => {
        const packPath = ['packs', this._source, this._pack];
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
      sourceAlias: this._source,
      packName: this._pack,
      packCreated: existingPack === undefined,
      addedItems,
      skippedItems,
    };
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
