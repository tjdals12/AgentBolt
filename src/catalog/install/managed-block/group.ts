import type { ToolId } from '#catalog/tool/model.js';

import type { ManagedBlock, ToolPlan } from '../model.js';

export type AggregatedManagedBlock = {
  filePath: string;
  fragments: string[];
  tools: ToolId[];
};

export function groupManagedBlocksByFile(toolPlans: ToolPlan[]): AggregatedManagedBlock[] {
  const byFile = new Map<string, ManagedBlock & { tools: ToolId[] }>();

  for (const { tool, managedBlock } of toolPlans) {
    if (!managedBlock) {
      continue;
    }

    const existing = byFile.get(managedBlock.filePath);
    if (existing) {
      existing.tools.push(tool);
      existing.fragments = [...new Set([...existing.fragments, ...managedBlock.fragments])];
      existing.references = [...new Set([...existing.references, ...managedBlock.references])];
      continue;
    }

    byFile.set(managedBlock.filePath, {
      filePath: managedBlock.filePath,
      fragments: managedBlock.fragments,
      references: managedBlock.references,
      tools: [tool],
    });
  }

  const aggregatedManagedBlocks = [...byFile.values()];
  const renderedManagedBlocks = aggregatedManagedBlocks.map(({ references, ...block }) => {
    if (references.length > 0) {
      const referenceList = [
        '# Referenced guidelines',
        '',
        'Read the relevant guidelines below before performing the corresponding work.',
        '',
        ...references,
      ].join('\n');
      block.fragments = [referenceList, ...block.fragments];
    }
    return block;
  });

  return renderedManagedBlocks;
}
