import { z } from 'zod';

import fs from 'node:fs';
import path from 'node:path';

import { PACK_MANIFEST_FILENAME, PackManifestSchema } from '#catalog/content/pack/schema.js';
import { CATALOG_MANIFEST_FILENAME, PACKS_DIR_NAME } from '#catalog/content/schema.js';

export type NewPackResult = {
  catalogDir: string;
  name: string;
  description: string;
  createdPaths: string[];
};

export class NewPackCommand {
  private readonly _name: string;
  private readonly _description?: string;

  constructor(options: { name: string; description?: string }) {
    this._name = options.name;
    this._description = options.description;
  }

  execute(catalogDir: string): NewPackResult {
    const catalogExists = fs.existsSync(catalogDir);
    if (!catalogExists) {
      throw new Error(`directory not found: ${catalogDir}`);
    }

    const catalogManifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
    const catalogManifestExists = fs.existsSync(catalogManifestPath);
    if (!catalogManifestExists) {
      throw new Error(`not a catalog directory: ${catalogDir} (no ${CATALOG_MANIFEST_FILENAME})`);
    }

    const name = this._name;
    const description = this._description ?? 'TODO: describe this pack';

    const manifest = { name, description };
    const parsed = PackManifestSchema.safeParse(manifest);
    if (parsed.error) {
      throw new Error(`Invalid pack manifest:\n${z.prettifyError(parsed.error)}`);
    }

    const packDir = path.join(catalogDir, PACKS_DIR_NAME, name);
    const packExists = fs.existsSync(packDir);
    if (packExists) {
      throw new Error(
        `${PACKS_DIR_NAME}/${name}/ already exists at ${catalogDir}.\n  Edit it directly, or remove it first.`,
      );
    }

    const packManifestPath = path.join(packDir, PACK_MANIFEST_FILENAME);

    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(packManifestPath, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf-8');

    return {
      catalogDir,
      name,
      description,
      createdPaths: [
        `${PACKS_DIR_NAME}/${name}/`,
        `${PACKS_DIR_NAME}/${name}/${PACK_MANIFEST_FILENAME}`,
      ],
    };
  }
}
