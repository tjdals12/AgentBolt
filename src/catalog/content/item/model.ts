import type { GuidelineRecommendation, ToolConfig } from './schema.js';

export type ItemType = 'skills' | 'agents' | 'guidelines';
export const ITEM_TYPES = ['skills', 'agents', 'guidelines'] as const satisfies ItemType[];

export type Item = {
  name: string;
  description: string;
};

export type GuidelineItem = Item & { recommended: GuidelineRecommendation };

export type Skill = Item & {
  toolConfig?: ToolConfig;
  instructions: string;
  sourceDir: string;
  assets: string[];
};

export type Agent = Item & { toolConfig?: ToolConfig; instructions: string };

export type Guideline = GuidelineItem & {
  body: string;
};
