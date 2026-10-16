import { buildCatalogConfigPath } from '#core/paths.js';
import { loadConfig } from '#catalog/config/load.js';
import { DEFAULT_GUIDELINE_USAGE } from '#catalog/install/reference.js';
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

export type SyncResult = {
  toolSyncResults: ToolSyncResult[];
  warnings: string[];
};

export class SyncCommand {
  execute(projectPath: string): SyncResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const toolPlans = computePlan(projectPath, config);
    const warnings: string[] = [];
    const checkedGuidelineIds = new Set<string>();
    for (const { renderedGuidelines } of toolPlans) {
      for (const { kind, sourceAlias, packName, guidelineName, usage } of renderedGuidelines) {
        if (kind !== 'reference-file') continue;
        if (usage !== undefined) continue;

        const guidelineId = `${sourceAlias}/${packName}/${guidelineName}`;
        if (checkedGuidelineIds.has(guidelineId)) continue;

        checkedGuidelineIds.add(guidelineId);

        warnings.push(
          [
            `Guideline '${guidelineId}' is missing usage.`,
            '',
            `  Using fallback text: "${DEFAULT_GUIDELINE_USAGE}"`,
            '',
            '  Set usage in .agent-bolt/catalog-config.yml to customize this text:',
            `    packs.${sourceAlias}.${packName}.guidelines.${guidelineName}.usage`,
          ].join('\n'),
        );
      }
    }
    const changeSet = applyPlan(projectPath, toolPlans);

    const toolSyncResults = this.buildToolSyncResults(toolPlans, changeSet);

    return { toolSyncResults, warnings };
  }

  toJson(result: SyncResult) {
    const { toolSyncResults, warnings } = result;
    return {
      tools: toolSyncResults.map(({ tool, counts, changes }) => ({ tool, counts, changes })),
      warnings,
    };
  }

  private buildToolSyncResults(toolPlans: ToolPlan[], changeSet: ChangeSet): ToolSyncResult[] {
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
