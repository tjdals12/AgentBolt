import { z } from 'zod';

import { SourceSchema } from '#catalog/source/schema.js';
import { TOOL_IDS } from '#catalog/tool/model.js';

export const CONFIG_VERSION = 1;

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NameSchema = z
  .string()
  .regex(NAME_PATTERN, 'Must be a kebab-case identifier (lowercase letters, digits, hyphens).');

export const GuidelineSelectionSchema = z.discriminatedUnion('load', [
  z.object({ load: z.literal('always') }),
  z.object({ load: z.literal('conditional'), glob: z.array(z.string()).min(1) }),
]);

export const PackSelectionSchema = z.object({
  skills: z.array(NameSchema).default([]),
  agents: z.array(NameSchema).default([]),
  guidelines: z.record(NameSchema, GuidelineSelectionSchema).default({}),
});

export const SourcesSchema = z.record(z.string(), SourceSchema);

export const SourcePacksSchema = z.record(NameSchema, PackSelectionSchema);

export const PacksSchema = z.record(z.string(), SourcePacksSchema);

export const ConfigSchema = z.object({
  version: z.literal(CONFIG_VERSION),
  tools: z
    .array(z.enum(TOOL_IDS))
    .meta({ description: 'AI tools to install for', examples: [['codex', 'claude']] }),
  sources: SourcesSchema.meta({ description: 'catalogs to pull assets from (alias → source)' }),
  packs: PacksSchema.default({}),
});

export type GuidelineSelection = z.infer<typeof GuidelineSelectionSchema>;
export type PackSelection = z.infer<typeof PackSelectionSchema>;
export type Sources = z.infer<typeof SourcesSchema>;
export type SourcePacks = z.infer<typeof SourcePacksSchema>;
export type Packs = z.infer<typeof PacksSchema>;
export type Config = z.infer<typeof ConfigSchema>;
