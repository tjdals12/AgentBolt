import path from 'node:path';
import fs from 'node:fs';

import { CATALOG_MANIFEST_FILENAME, PACKS_DIR_NAME } from './schema.js';
import { loadCatalog } from './load.js';
import { listPackDirs, parsePackSummary, parsePackDetail } from './pack/parse.js';
import type { PackSummary, PackDetail } from './pack/model.js';

export function parseCatalogSummary(catalogDir: string): PackSummary[] {
  const manifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
  const manifestExists = fs.existsSync(manifestPath);
  if (!manifestExists) {
    throw new Error(`catalog.json not found: ${manifestPath}. Not a valid catalog directory.`);
  }

  loadCatalog(manifestPath);

  const packsDirPath = path.join(catalogDir, PACKS_DIR_NAME);
  const packDirs = listPackDirs(packsDirPath);
  const packs = packDirs.map((packDir) => parsePackSummary(packDir));

  return packs;
}

export function parseCatalogDetail(catalogDir: string): PackDetail[] {
  const manifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
  const manifestExists = fs.existsSync(manifestPath);
  if (!manifestExists) {
    throw new Error(`catalog.json not found: ${manifestPath}. Not a valid catalog directory.`);
  }

  loadCatalog(manifestPath);

  const packDirPath = path.join(catalogDir, PACKS_DIR_NAME);
  const packDirs = listPackDirs(packDirPath);
  const packs = packDirs.map((packDir) => parsePackDetail(packDir));

  return packs;
}
