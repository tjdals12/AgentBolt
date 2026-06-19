import { z } from 'zod';

import path from 'node:path';
import fs from 'node:fs';

import {
  CATALOG_MANIFEST_FILENAME,
  CATALOG_MANIFEST_VERSION,
  CatalogManifestSchema,
  PACKS_DIR_NAME,
} from '#catalog/content/schema.js';

export type InitCatalogResult = {
  catalogDir: string;
  name: string;
  description: string;
  createdPaths: string[];
};

export class InitCatalogCommand {
  private readonly _name?: string;
  private readonly _description?: string;

  constructor(options: { name?: string; description?: string }) {
    this._name = options.name;
    this._description = options.description;
  }

  execute(catalogDir: string): InitCatalogResult {
    const manifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
    const manifestExists = fs.existsSync(manifestPath);
    if (manifestExists) {
      throw new Error(
        `${CATALOG_MANIFEST_FILENAME} already exists at ${catalogDir}.\n  This is already a catalog - edit it directly, or pick another directory.`,
      );
    }

    const name = this._name ?? path.basename(catalogDir);
    const description = this._description ?? 'TODO: describe this catalog';

    const manifest = {
      schemaVersion: CATALOG_MANIFEST_VERSION,
      name,
      description,
    };
    const parsed = CatalogManifestSchema.safeParse(manifest);
    if (parsed.error) {
      throw new Error(`Invalid catalog manifest:\n${z.prettifyError(parsed.error)}`);
    }

    const packsDir = path.join(catalogDir, PACKS_DIR_NAME);

    fs.mkdirSync(catalogDir, { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf-8');
    fs.mkdirSync(packsDir, { recursive: true });

    return {
      catalogDir,
      name,
      description,
      createdPaths: [CATALOG_MANIFEST_FILENAME, `${PACKS_DIR_NAME}/`],
    };
  }
}
