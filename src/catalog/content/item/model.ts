import type { GuidelineManifest, ToolConfig } from './schema.js';

export type ItemType = 'skills' | 'agents' | 'guidelines';
export const ITEM_TYPES = ['skills', 'agents', 'guidelines'] as const satisfies ItemType[];

export type Item = {
  name: string;
  description: string;
};

export type GuidelineItem = Item & Pick<GuidelineManifest, 'recommended' | 'usage'>;

export type Skill = Item & {
  toolConfig?: ToolConfig;
  instructions: string;
  instructionsPath: string;
  sourceDir: string;
  assets: string[];
};

export type Agent = Item & {
  toolConfig?: ToolConfig;
  instructions: string;
  instructionsPath: string;
};

export type Guideline = GuidelineItem & {
  body: string;
  bodyPath: string;
};
