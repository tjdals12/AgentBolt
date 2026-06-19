import { type ZodType, z } from 'zod';

import fs from 'node:fs';
import path from 'node:path';

import { CATALOG_MANIFEST_FILENAME, PACKS_DIR_NAME } from '#catalog/content/schema.js';

export type ItemSpec = {
  typeDir: string;
  manifestFilename: string;
  manifestSchema: ZodType;
  buildManifest: (args: {
    name: string;
    description: string;
    bodyRef: string;
  }) => Record<string, unknown>;
  bodyFilename: string;
  bodyContent: string;
};

export type NewItemResult = {
  catalogDir: string;
  packName: string;
  item: { name: string; description: string };
  createdPaths: string[];
};

export abstract class NewItemCommand {
  protected abstract _spec: ItemSpec;

  private readonly _pack: string;
  private readonly _name: string;
  private readonly _description?: string;

  constructor(options: { pack: string; name: string; description?: string }) {
    this._pack = options.pack;
    this._name = options.name;
    this._description = options.description;
  }

  execute(catalogDir: string): NewItemResult {
    const catalogExists = fs.existsSync(catalogDir);
    if (!catalogExists) {
      throw new Error(`directory not found: ${catalogDir}`);
    }

    const catalogManifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
    const catalogManifestExists = fs.existsSync(catalogManifestPath);
    if (!catalogManifestExists) {
      throw new Error(`not a catalog directory: ${catalogDir} (no ${CATALOG_MANIFEST_FILENAME})`);
    }

    const packsDir = path.join(catalogDir, PACKS_DIR_NAME);

    const packName = this._pack;
    const packDir = path.join(packsDir, packName);

    const withinPacks = this.isWithinDir(packsDir, packDir);
    if (!withinPacks) {
      throw new Error(`invalid pack name '${packName}'.`);
    }

    const packExists = fs.existsSync(packDir);
    if (!packExists) {
      throw new Error(
        `pack '${packName}' does not exist.\n  Create it first: agent-bolt catalog new-pack ${packName}`,
      );
    }

    const { typeDir, manifestFilename, manifestSchema, buildManifest, bodyFilename, bodyContent } =
      this._spec;

    const name = this._name;
    const description = this._description ?? `TODO: describe this item`;
    const bodyRef = `./${bodyFilename}`;

    const manifest = buildManifest({ name, description, bodyRef });
    const parsed = manifestSchema.safeParse(manifest);
    if (parsed.error) {
      throw new Error(`Invalid item manifest:\n${z.prettifyError(parsed.error)}`);
    }

    const itemDir = path.join(packDir, typeDir, name);
    const itemExists = fs.existsSync(itemDir);
    if (itemExists) {
      throw new Error(
        `${PACKS_DIR_NAME}/${packName}/${typeDir}/${name}/ already exists at ${catalogDir}.\n  Edit it directly, or remove it first.`,
      );
    }

    const itemManifestPath = path.join(itemDir, manifestFilename);
    const bodyPath = path.join(itemDir, bodyFilename);

    fs.mkdirSync(itemDir, { recursive: true });
    fs.writeFileSync(itemManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
    fs.writeFileSync(bodyPath, `# ${name}\n\nTODO: ${bodyContent}.\n`, 'utf-8');

    return {
      catalogDir,
      packName,
      item: {
        name,
        description,
      },
      createdPaths: [
        `${path.relative(catalogDir, itemDir)}/`,
        path.relative(catalogDir, itemManifestPath),
        path.relative(catalogDir, bodyPath),
      ],
    };
  }

  private isWithinDir(parentDir: string, dir: string): boolean {
    const abs = path.resolve(parentDir, dir);
    const rel = path.relative(parentDir, abs);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  }
}
