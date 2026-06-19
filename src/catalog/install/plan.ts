import path from 'node:path';
import fs from 'node:fs';

import { loadCatalog } from '#catalog/content/load.js';
import { CATALOG_MANIFEST_FILENAME } from '#catalog/content/schema.js';
import type { Config } from '#catalog/config/schema.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';

import { getAdapters } from './adapters/registry.js';
import type { RenderedAgent, RenderedGuideline, RenderedSkill, ToolPlan } from './model.js';
import { parseAgent, parseGuideline, parseSkill } from '#catalog/content/item/parse-detail.js';

export function computePlan(projectPath: string, config: Config): ToolPlan[] {
  const { tools, sources, packs } = config;

  const sourceAliases = Object.keys(packs);
  const catalogDirs = new Map<string, string>();

  for (const sourceAlias of sourceAliases) {
    const source = sources[sourceAlias];
    if (source) {
      const catalogDir = resolveCatalogDir(projectPath, sourceAlias, source);

      const manifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
      const manifestExists = fs.existsSync(manifestPath);
      if (!manifestExists) {
        throw new Error(`catalog.json not found: ${manifestPath}. Not a valid catalog directory.`);
      }
      loadCatalog(manifestPath);

      catalogDirs.set(sourceAlias, catalogDir);
    }
  }

  const packsBySource = Object.entries(packs);
  const adapters = getAdapters(tools);
  const toolPlans: ToolPlan[] = [];

  for (const adapter of adapters) {
    const renderedSkills: RenderedSkill[] = [];
    const renderedAgents: RenderedAgent[] = [];
    const renderedGuidelines: RenderedGuideline[] = [];

    for (const [sourceAlias, sourcePacks] of packsBySource) {
      const catalogDir = catalogDirs.get(sourceAlias);
      if (catalogDir) {
        const packSelections = Object.entries(sourcePacks);
        for (const [packName, selection] of packSelections) {
          const { skills, agents, guidelines } = selection;

          for (const skillName of skills) {
            const skill = parseSkill(catalogDir, packName, skillName);
            const renderedSkill = adapter.renderSkill(sourceAlias, packName, skill);
            renderedSkills.push(renderedSkill);
          }

          for (const agentName of agents) {
            const agent = parseAgent(catalogDir, packName, agentName);
            const renderedAgent = adapter.renderAgent(sourceAlias, packName, agent);
            renderedAgents.push(renderedAgent);
          }

          const guidelineEntries = Object.entries(guidelines);
          for (const [guidelineName, guidelineSelection] of guidelineEntries) {
            const guideline = parseGuideline(catalogDir, packName, guidelineName);
            const renderedGuideline = adapter.renderGuideline(
              sourceAlias,
              packName,
              guideline,
              guidelineSelection,
            );
            renderedGuidelines.push(renderedGuideline);
          }
        }
      }
    }

    const fragments = renderedGuidelines.flatMap((renderedGuideline) =>
      renderedGuideline.kind === 'block-fragment' ? [renderedGuideline.fragment] : [],
    );
    const managedBlock =
      fragments.length > 0 && adapter.managedBlockFile
        ? { filePath: adapter.managedBlockFile, fragments }
        : undefined;

    toolPlans.push({
      tool: adapter.id,
      renderedSkills,
      renderedAgents,
      renderedGuidelines,
      managedBlock,
    });
  }

  return toolPlans;
}
