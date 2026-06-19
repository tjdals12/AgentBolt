import { z } from 'zod';

export const SUPPORTED_SOURCE_TYPES = ['local', 'git'];

const LocalSourceSchema = z.object({
  type: z.literal('local'),
  path: z
    .string()
    .min(1)
    .meta({ description: 'local filesystem path to the catalog', examples: ['./catalog'] }),
});

const GitSourceSchema = z.object({
  type: z.literal('git'),
  url: z
    .string()
    .min(1)
    .meta({ description: 'git remote URL', examples: ['https://github.com/acme/catalog.git'] }),
  ref: z
    .string()
    .optional()
    .meta({
      description: 'optional — branch/tag (default: repo default branch)',
      examples: ['main'],
    }),
  subdir: z
    .string()
    .optional()
    .meta({ description: 'optional — path within the repo if not at root', examples: ['catalog'] }),
});

export const SourceSchema = z.discriminatedUnion('type', [LocalSourceSchema, GitSourceSchema]);

export type Source = z.infer<typeof SourceSchema>;
