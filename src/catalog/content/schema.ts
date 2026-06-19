import { z } from 'zod';

export const CATALOG_MANIFEST_VERSION = 1;

export const CATALOG_MANIFEST_FILENAME = 'catalog.json';

export const CatalogManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const PACKS_DIR_NAME = 'packs';

export const SKILLS_DIR_NAME = 'skills';
export const AGENTS_DIR_NAME = 'agents';
export const GUIDELINES_DIR_NAME = 'guidelines';

export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;
