import { buildCatalogConfigPath } from '#core/paths.js';
import { loadConfig } from '#catalog/config/load.js';
import { computePlan } from '#catalog/install/plan.js';
import { applyPlan } from '#catalog/install/apply.js';
import type { SyncChange, ChangeSet, ToolPlan } from '#catalog/install/model.js';
import type { ToolId } from '#catalog/tool/model.js';

export type ToolSyncResult = {
  tool: ToolId;
  counts: {
    skills: number;
    agents: number;
    guidelines: number;
  };
  changes: SyncChange[];
};

export type SyncResult = ToolSyncResult[];

export class SyncCommand {
  execute(projectPath: string): SyncResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const toolPlans = computePlan(projectPath, config);
    const changeSet = applyPlan(projectPath, toolPlans);

    const syncResult = this.buildSyncResult(toolPlans, changeSet);

    return syncResult;
  }

  toJson(result: SyncResult) {
    return {
      tools: result.map(({ tool, counts, changes }) => ({ tool, counts, changes })),
    };
  }

  private buildSyncResult(toolPlans: ToolPlan[], changeSet: ChangeSet): SyncResult {
    return toolPlans.map((toolPlan) => {
      const { tool, renderedSkills, renderedAgents, renderedGuidelines } = toolPlan;
      const counts = {
        skills: renderedSkills.length,
        agents: renderedAgents.length,
        guidelines: renderedGuidelines.length,
      };
      const changes = changeSet[tool] ?? [];

      return {
        tool,
        counts,
        changes,
      };
    });
  }
}
