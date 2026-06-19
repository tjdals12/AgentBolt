import { z } from 'zod';

export const PACK_MANIFEST_FILENAME = 'pack.json';

export const PackManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Must be a kebab-case identifier (lowercase letters, digits, hyphens; e.g. create-commit).',
  }),
  description: z.string().min(1),
});

export type PackManifest = z.infer<typeof PackManifestSchema>;
