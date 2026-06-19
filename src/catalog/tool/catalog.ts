import { TOOL_IDS, type Tool, type ToolId } from './model.js';

type SupportedTools = { [K in ToolId]: Tool & { id: K } };

export const SUPPORTED_TOOLS: SupportedTools = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    marker: '.claude',
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    marker: '.codex',
  },
};

export function listTools(): Tool[] {
  return TOOL_IDS.map((id) => SUPPORTED_TOOLS[id]);
}

export function getTool(id: ToolId): Tool {
  return SUPPORTED_TOOLS[id];
}

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}
