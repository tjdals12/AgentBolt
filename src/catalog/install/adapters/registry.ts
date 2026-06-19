import type { ToolId } from '#catalog/tool/model.js';

import type { Adapter } from './adapter.js';
import { ClaudeAdapter } from './claude.adapter.js';
import { CodexAdapter } from './codex.adapter.js';

const ADAPTERS: Record<ToolId, Adapter> = {
  claude: new ClaudeAdapter(),
  codex: new CodexAdapter(),
};

export function getAdapters(toolIds: ToolId[]): Adapter[] {
  return toolIds.map((toolId) => ADAPTERS[toolId]);
}
