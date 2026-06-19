import type { ToolId } from '#catalog/tool/model.js';

export type RenderedSkill = {
  packName: string;
  skillName: string;
  dir: string;
  entryFileName: string;
  entryContent: string;
  sourceDir: string;
  assets: string[];
};
export type RenderedAgent = {
  packName: string;
  agentName: string;
  filePath: string;
  content: string;
};
export type RenderedGuideline =
  | {
      kind: 'rule-file';
      packName: string;
      guidelineName: string;
      filePath: string;
      content: string;
    }
  | {
      kind: 'block-fragment';
      packName: string;
      guidelineName: string;
      fragment: string;
    };

export type ManagedBlock = {
  filePath: string;
  fragments: string[];
};

export type ToolPlan = {
  tool: ToolId;
  renderedSkills: RenderedSkill[];
  renderedAgents: RenderedAgent[];
  renderedGuidelines: RenderedGuideline[];
  managedBlock?: ManagedBlock;
};

export type ChangeStatus = 'installed' | 'updated' | 'removed';

export type SyncChange = {
  label: string;
  status: ChangeStatus;
};

export type ChangeSet = Record<string, SyncChange[]>;
