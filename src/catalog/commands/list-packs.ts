import { buildCatalogConfigPath } from '#core/paths.js';
import { loadConfig } from '#catalog/config/load.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import { parseCatalogSummary } from '#catalog/content/parse.js';
import type { SourceCatalogSummary } from '#catalog/content/model.js';
import type { ProgressReporter } from '#core/progress.js';

export type ListPacksResult = {
  sourceCatalogs: SourceCatalogSummary[];
  failures: string[];
};

export class ListPacksCommand {
  private readonly _source?: string;

  constructor(options: { source?: string }) {
    this._source = options.source;
  }

  execute(projectPath: string, reporter: ProgressReporter): ListPacksResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const sourceCatalogs: SourceCatalogSummary[] = [];
    const failures: string[] = [];

    if (this._source) {
      const source = config.sources[this._source];
      if (!source) {
        throw new Error(`source '${this._source}' not found in ${configPath}`);
      }

      reporter.start(`Resolving source '${this._source}'`);

      try {
        const catalogDir = resolveCatalogDir(projectPath, this._source, source);
        const packs = parseCatalogSummary(catalogDir);
        sourceCatalogs.push({ alias: this._source, type: source.type, packs });

        reporter.succeed(
          `source '${this._source}' (${packs.length} ${packs.length === 1 ? 'pack' : 'packs'})`,
        );
      } catch (e) {
        reporter.stop();

        throw e;
      }
    } else {
      const sources = Object.entries(config.sources);
      for (const [alias, source] of sources) {
        reporter.start(`Resolving source '${alias}'`);

        try {
          const catalogDir = resolveCatalogDir(projectPath, alias, source);
          const packs = parseCatalogSummary(catalogDir);
          sourceCatalogs.push({ alias, type: source.type, packs });

          reporter.succeed(
            `source '${alias}' (${packs.length} ${packs.length === 1 ? 'pack' : 'packs'})`,
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          failures.push(message);

          reporter.fail(message);
        }
      }
    }

    return { sourceCatalogs, failures };
  }
}
