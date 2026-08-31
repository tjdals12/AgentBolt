import path from 'node:path';
import fs from 'node:fs';

import type { ChangeSet, SyncChange, ToolPlan } from './model.js';
import { loadLockfile } from './lockfile/load.js';
import { collectInstalledItems, findOrphans } from './lockfile/items.js';
import { classifyChange, classifySkill } from './classify.js';
import {
  buildManagedBlock,
  buildManagedBlockContent,
  replaceManagedBlock,
} from './managed-block/render.js';
import { groupManagedBlocksByFile } from './managed-block/group.js';

export function diffPlan(projectPath: string, toolPlans: ToolPlan[]): ChangeSet {
  const previousLockfile = loadLockfile(projectPath);
  const previousItems = previousLockfile.installedItems;
  const currentItems = collectInstalledItems(toolPlans);

  const changeSet: ChangeSet = {};

  for (const toolPlan of toolPlans) {
    const { tool, renderedSkills, renderedAgents, renderedGuidelines } = toolPlan;

    const changes: SyncChange[] = [];

    for (const renderedSkill of renderedSkills) {
      const { sourceAlias, packName, skillName } = renderedSkill;

      const status = classifySkill(projectPath, renderedSkill);
      if (status) {
        changes.push({
          source: sourceAlias,
          label: `${packName}/${skillName}`,
          status,
        });
      }
    }

    for (const renderedAgent of renderedAgents) {
      const { sourceAlias, packName, agentName, filePath, content } = renderedAgent;
      const agentFilePath = path.join(projectPath, filePath);

      const before = fs.existsSync(agentFilePath) ? fs.readFileSync(agentFilePath, 'utf-8') : null;

      const status = classifyChange(before, content);
      if (status) {
        changes.push({
          source: sourceAlias,
          label: `${packName}/${agentName}`,
          status,
        });
      }
    }

    for (const renderedGuideline of renderedGuidelines) {
      const { packName, guidelineName, kind } = renderedGuideline;
      if (kind === 'rule-file') {
        const { sourceAlias, filePath, content } = renderedGuideline;
        const guidelineFilePath = path.join(projectPath, filePath);

        const before = fs.existsSync(guidelineFilePath)
          ? fs.readFileSync(guidelineFilePath, 'utf-8')
          : null;

        const status = classifyChange(before, content);
        if (status) {
          changes.push({
            source: sourceAlias,
            label: `${packName}/${guidelineName}`,
            status,
          });
        }
      }
    }

    changeSet[tool] = changes;
  }

  const managedBlocks = groupManagedBlocksByFile(toolPlans);
  for (const { filePath, fragments, tools } of managedBlocks) {
    const blockFilePath = path.join(projectPath, filePath);

    const before = fs.existsSync(blockFilePath) ? fs.readFileSync(blockFilePath, 'utf-8') : null;

    const blockContent = buildManagedBlockContent(fragments);
    const content =
      before === null ? buildManagedBlock(blockContent) : replaceManagedBlock(before, blockContent);

    const status = classifyChange(before, content);
    if (status) {
      for (const tool of tools) {
        (changeSet[tool] ??= []).push({
          source: null,
          label: `${filePath} (managed block)`,
          status,
        });
      }
    }
  }

  const removed = findOrphans(previousItems, currentItems);
  const removedItemsByTool = Object.entries(removed);
  for (const [tool, removedItems] of removedItemsByTool) {
    const syncChanges = removedItems.map<SyncChange>((removedItem) => ({
      source: null,
      label: removedItem.label,
      status: 'removed',
    }));
    if (changeSet[tool]) {
      changeSet[tool].push(...syncChanges);
    } else {
      changeSet[tool] = syncChanges;
    }
  }

  return changeSet;
}
