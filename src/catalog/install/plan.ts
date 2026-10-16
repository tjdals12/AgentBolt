import path from 'node:path';
import fs from 'node:fs';

import { loadCatalog } from '#catalog/content/load.js';
import { CATALOG_MANIFEST_FILENAME } from '#catalog/content/schema.js';
import type { Config } from '#catalog/config/schema.js';
import { resolveCatalogDir } from '#catalog/source/resolve.js';
import type { ToolId } from '#catalog/tool/model.js';

import { getAdapters } from './adapters/registry.js';
import type { RenderedAgent, RenderedGuideline, RenderedSkill, ToolPlan } from './model.js';
import { parseAgent, parseGuideline, parseSkill } from '#catalog/content/item/parse-detail.js';
import { loadLockfile } from './lockfile/load.js';
import { resolveReferenceDirectory } from './reference.js';
import { isManagedBlockPresent } from './managed-block/render.js';

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
            let resolvedGuidelineSelection = guidelineSelection;
            if (guidelineSelection.load === 'reference') {
              const resolvedReferenceDirectory = resolveReferenceDirectory(
                projectPath,
                guidelineSelection.path,
              );
              resolvedGuidelineSelection = {
                ...guidelineSelection,
                path: resolvedReferenceDirectory,
              };
            }
            const renderedGuideline = adapter.renderGuideline(
              sourceAlias,
              packName,
              guideline,
              resolvedGuidelineSelection,
            );
            renderedGuidelines.push(renderedGuideline);
          }
        }
      }
    }

    const fragments = renderedGuidelines.flatMap((renderedGuideline) =>
      renderedGuideline.kind === 'block-fragment' ? [renderedGuideline.fragment] : [],
    );
    const references = renderedGuidelines.flatMap((guideline) =>
      guideline.kind === 'reference-file' ? [guideline.reference] : [],
    );
    const managedBlock =
      (fragments.length > 0 || references.length > 0) && adapter.managedBlockFile
        ? { filePath: adapter.managedBlockFile, fragments, references }
        : undefined;

    toolPlans.push({
      tool: adapter.id,
      renderedSkills,
      renderedAgents,
      renderedGuidelines,
      managedBlock,
    });
  }

  const previousLockfile = loadLockfile(projectPath);
  const previousItems = previousLockfile.installedItems;

  const toolsToCheck = new Set(toolPlans.map(({ tool }) => tool));
  const previousToolIds = Object.keys(previousItems) as ToolId[];
  for (const previousTool of previousToolIds) {
    toolsToCheck.add(previousTool);
  }
  const cleanupAdapters = getAdapters([...toolsToCheck]);

  const managedBlockPaths = new Set(
    toolPlans.flatMap(({ managedBlock }) => (managedBlock ? [managedBlock.filePath] : [])),
  );

  for (const adapter of cleanupAdapters) {
    const managedBlockFile = adapter.managedBlockFile;
    if (!managedBlockFile) continue;

    const hasManagedBlockFile = managedBlockPaths.has(managedBlockFile);
    if (hasManagedBlockFile) continue;

    const managedBlockFilePath = path.join(projectPath, managedBlockFile);
    const managedBlockFileExists = fs.existsSync(managedBlockFilePath);
    if (!managedBlockFileExists) continue;

    const managedBlockContent = fs.readFileSync(managedBlockFilePath, 'utf-8');
    const managedBlockPresent = isManagedBlockPresent(managedBlockContent);
    if (!managedBlockPresent) continue;

    const emptyManagedBlock = {
      filePath: managedBlockFile,
      fragments: [],
      references: [],
    };
    const toolPlan = toolPlans.find(({ tool }) => tool === adapter.id);
    if (toolPlan) {
      toolPlan.managedBlock = emptyManagedBlock;
    } else {
      toolPlans.push({
        tool: adapter.id,
        renderedSkills: [],
        renderedAgents: [],
        renderedGuidelines: [],
        managedBlock: emptyManagedBlock,
      });
    }
  }

  return toolPlans;
}
