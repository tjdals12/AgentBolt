export const TOOL_IDS = ['claude', 'codex', 'cursor', 'copilot', 'opencode'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export type Tool = {
  id: ToolId;
  displayName: string;
  marker: string;
};
