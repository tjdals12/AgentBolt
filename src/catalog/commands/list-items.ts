import { loadConfig } from '#catalog/config/load.js';
import type { PackDetail } from '#catalog/content/pack/model.js';
import type { SourceCatalogDetail } from '#catalog/content/model.js';
import { parseCatalogDetail } from '#catalog/content/parse.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { buildCatalogConfigPath } from '#core/paths.js';

export type ListItemsResult = {
  sourceCatalogs: SourceCatalogDetail[];
  failures: string[];
};

export class ListItemsCommand {
  private readonly _source?: string;
  private readonly _packs?: string;

  constructor(options: { source?: string; packs?: string }) {
    this._source = options.source;
    this._packs = options.packs;
  }

  execute(projectPath: string): ListItemsResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const packNames = this.parsePackNames();

    const sourceCatalogs: SourceCatalogDetail[] = [];
    const failures: string[] = [];

    if (this._source) {
      const source = config.sources[this._source];
      if (!source) {
        throw new Error(`source '${this._source}' not found in ${configPath}`);
      }

      const catalogDir = resolveCatalogDir(projectPath, this._source, source);
      const packDetails = parseCatalogDetail(catalogDir);
      const selectedPackDetails = this.selectPacks(packDetails, packNames);
      sourceCatalogs.push({ alias: this._source, type: source.type, packs: selectedPackDetails });
    } else {
      const sources = Object.entries(config.sources);
      for (const [alias, source] of sources) {
        try {
          const catalogDir = resolveCatalogDir(projectPath, alias, source);
          const packDetails = parseCatalogDetail(catalogDir);
          const selectedPackDetails = this.selectPacks(packDetails, packNames);
          sourceCatalogs.push({ alias, type: source.type, packs: selectedPackDetails });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          failures.push(message);
        }
      }
    }

    if (packNames.length > 0) {
      const matched = new Set(
        sourceCatalogs.flatMap((sourceCatalog) => sourceCatalog.packs.map((pack) => pack.name)),
      );
      const unmatched = packNames.filter((packName) => !matched.has(packName));
      if (unmatched.length > 0) {
        failures.push(`unknown pack: ${unmatched.join(', ')} (not in any configured source)`);
      }
    }

    return {
      sourceCatalogs,
      failures,
    };
  }

  private parsePackNames(): string[] {
    if (!this._packs) return [];
    const packs = this._packs
      .split(',')
      .map((pack) => pack.trim())
      .filter((pack) => pack.length > 0);
    return [...new Set(packs)];
  }

  private selectPacks(packs: PackDetail[], packNames: string[]): PackDetail[] {
    if (packNames.length === 0) return packs;
    const filter = new Set(packNames);
    const selectedPacks = packs.filter((pack) => filter.has(pack.name));
    return selectedPacks;
  }
}
