import { z } from 'zod';

export const SKILL_MANIFEST_FILENAME = 'skill.json';
export const SKILL_INSTRUCTIONS_FILENAME = 'instructions.md';

export const AGENT_MANIFEST_FILENAME = 'agent.json';
export const AGENT_PROMPT_FILENAME = 'prompt.md';

export const GUIDELINE_MANIFEST_FILENAME = 'guideline.json';
export const GUIDELINE_BODY_FILENAME = 'content.md';

export const ItemManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Must be a kebab-case identifier (lowercase letters, digits, hyphens; e.g. create-commit).',
  }),
  description: z.string().min(1),
});
export const ToolConfigSchema = z.record(z.string(), z.record(z.string(), z.unknown()));
export const SkillManifestSchema = ItemManifestSchema.extend({
  toolConfig: ToolConfigSchema.optional(),
  instructions: z.string(),
  assets: z.array(z.string()).default([]),
});
export const AgentManifestSchema = ItemManifestSchema.extend({
  toolConfig: ToolConfigSchema.optional(),
  instructions: z.string(),
});
export const GuidelineRecommendationSchema = z.discriminatedUnion('load', [
  z.object({ load: z.literal('always') }),
  z.object({ load: z.literal('conditional'), glob: z.array(z.string()).min(1) }),
]);
export const GuidelineManifestSchema = ItemManifestSchema.extend({
  recommended: GuidelineRecommendationSchema,
  body: z.string(),
});

export type ItemManifest = z.infer<typeof ItemManifestSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type SkillManifest = z.infer<typeof SkillManifestSchema>;
export type AgentManifest = z.infer<typeof AgentManifestSchema>;
export type GuidelineRecommendation = z.infer<typeof GuidelineRecommendationSchema>;
export type GuidelineManifest = z.infer<typeof GuidelineManifestSchema>;
