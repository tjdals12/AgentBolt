import type { ToolId } from '#catalog/tool/model.js';

import type { ToolPlan } from '../model.js';

export type AggregatedManagedBlock = {
  filePath: string;
  fragments: string[];
  tools: ToolId[];
};

export function groupManagedBlocksByFile(toolPlans: ToolPlan[]): AggregatedManagedBlock[] {
  const byFile = new Map<string, AggregatedManagedBlock>();

  for (const { tool, managedBlock } of toolPlans) {
    if (!managedBlock) {
      continue;
    }

    const existing = byFile.get(managedBlock.filePath);
    if (existing) {
      existing.tools.push(tool);
      continue;
    }

    byFile.set(managedBlock.filePath, {
      filePath: managedBlock.filePath,
      fragments: managedBlock.fragments,
      tools: [tool],
    });
  }

  return [...byFile.values()];
}
