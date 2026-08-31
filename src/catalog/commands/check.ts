import { loadConfig } from '#catalog/config/load.js';
import type { ChangeSet, SyncChange, ToolPlan } from '#catalog/install/model.js';
import { computePlan } from '#catalog/install/plan.js';
import { diffPlan } from '#catalog/install/diff.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import type { ToolId } from '#catalog/tool/model.js';

export type ToolCheckResult = {
  tool: ToolId;
  counts: {
    skills: number;
    agents: number;
    guidelines: number;
  };
  changes: SyncChange[];
};

export type CheckResult = ToolCheckResult[];

export class CheckCommand {
  execute(projectPath: string): { checkResult: CheckResult; drifted: boolean } {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const toolPlans = computePlan(projectPath, config);
    const changeSet = diffPlan(projectPath, toolPlans);

    const checkResult = this.buildCheckResults(toolPlans, changeSet);
    const drifted = checkResult.some((toolCheckResult) => toolCheckResult.changes.length > 0);

    return { checkResult, drifted };
  }

  toJson(result: { checkResult: CheckResult; drifted: boolean }) {
    const { checkResult, drifted } = result;
    return {
      tools: checkResult.map(({ tool, counts, changes }) => ({
        tool,
        counts,
        changes: changes.map(({ source, label, status }) => ({
          source,
          label,
          status:
            status === 'installed' ? 'missing' : status === 'updated' ? 'drifted' : 'orphaned',
        })),
      })),
      drifted,
    };
  }

  private buildCheckResults(toolPlans: ToolPlan[], changeSet: ChangeSet): CheckResult {
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
