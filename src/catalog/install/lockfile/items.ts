import type { ToolPlan } from '../model.js';
import type { InstalledItem, InstalledItems } from './model.js';

export function collectInstalledItems(toolPlans: ToolPlan[]): InstalledItems {
  const byTool: InstalledItems = {};

  for (const toolPlan of toolPlans) {
    const { tool, renderedSkills, renderedAgents, renderedGuidelines } = toolPlan;

    const items: InstalledItem[] = [];

    for (const renderedSkill of renderedSkills) {
      const { packName, skillName, dir } = renderedSkill;
      items.push({ label: `${packName}/${skillName}`, path: dir });
    }

    for (const renderedAgent of renderedAgents) {
      const { packName, agentName, filePath } = renderedAgent;
      items.push({ label: `${packName}/${agentName}`, path: filePath });
    }

    for (const renderedGuideline of renderedGuidelines) {
      if (renderedGuideline.kind === 'rule-file') {
        const { packName, guidelineName, filePath } = renderedGuideline;
        items.push({ label: `${packName}/${guidelineName}`, path: filePath });
      }
    }

    byTool[tool] = items;
  }

  return byTool;
}

export function findOrphans(previous: InstalledItems, current: InstalledItems): InstalledItems {
  const currentPaths = new Set(
    Object.values(current)
      .flat()
      .map((item) => item.path),
  );

  const orphansByTool: InstalledItems = {};
  for (const [tool, items] of Object.entries(previous)) {
    const orphans = items.filter((item) => !currentPaths.has(item.path));
    if (orphans.length > 0) {
      orphansByTool[tool] = orphans;
    }
  }

  return orphansByTool;
}
