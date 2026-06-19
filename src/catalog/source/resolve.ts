import type { Source } from '#catalog/source/schema.js';
import { resolveLocalSource } from '#catalog/source/resolve-local.js';
import { resolveGitSource } from '#catalog/source/resolve-git.js';

export function resolveCatalogDir(projectPath: string, alias: string, source: Source): string {
  if (source.type === 'local') {
    return resolveLocalSource(projectPath, alias, source);
  }

  if (source.type === 'git') {
    return resolveGitSource(alias, source);
  }

  throw new Error(`source '${alias}': unsupported source type`);
}
