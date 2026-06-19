import { z } from 'zod';

import { readJsonFile } from '#core/json.js';

import { CATALOG_MANIFEST_VERSION, CatalogManifestSchema, type CatalogManifest } from './schema.js';

export function loadCatalog(manifestPath: string): CatalogManifest {
  const raw = readJsonFile(manifestPath);

  const parsed = CatalogManifestSchema.safeParse(raw);
  if (parsed.error) {
    throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
  }

  const manifest = parsed.data;
  if (manifest.schemaVersion !== CATALOG_MANIFEST_VERSION) {
    const message =
      manifest.schemaVersion > CATALOG_MANIFEST_VERSION
        ? `This tool supports schemaVersion up to v${CATALOG_MANIFEST_VERSION}, but the catalog requires v${manifest.schemaVersion}.`
        : `This tool requires schemaVersion v${CATALOG_MANIFEST_VERSION}, but the catalog is v${manifest.schemaVersion}. Update the catalog to v${CATALOG_MANIFEST_VERSION}`;
    throw new Error(`Catalog schemaVersion mismatch (${manifestPath}):\n ${message}`);
  }

  return manifest;
}
