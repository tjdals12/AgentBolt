import path from 'node:path';
import fs from 'node:fs';

import type { SyncChange, ChangeSet, ToolPlan } from './model.js';
import { loadLockfile } from './lockfile/load.js';
import { buildLockfile, writeLockfile } from './lockfile/write.js';
import { collectInstalledItems, findOrphans } from './lockfile/items.js';
import {
  buildManagedBlock,
  buildManagedBlockContent,
  replaceManagedBlock,
} from './managed-block.js';
import { classifyChange, classifySkill } from './classify.js';

export function applyPlan(projectPath: string, toolPlans: ToolPlan[]): ChangeSet {
  const previousLockfile = loadLockfile(projectPath);
  const previousItems = previousLockfile.installedItems;
  const currentItems = collectInstalledItems(toolPlans);
  const currentLockfile = buildLockfile(currentItems);

  const changeSet: ChangeSet = {};

  for (const toolPlan of toolPlans) {
    const { tool, renderedSkills, renderedAgents, renderedGuidelines, managedBlock } = toolPlan;

    const syncChanges: SyncChange[] = [];

    for (const renderedSkill of renderedSkills) {
      const { packName, skillName, dir, entryFileName, entryContent, sourceDir, assets } =
        renderedSkill;
      const skillDirPath = path.join(projectPath, dir);
      const skillEntryFilePath = path.join(skillDirPath, entryFileName);

      const status = classifySkill(projectPath, renderedSkill);

      fs.rmSync(skillDirPath, { recursive: true, force: true });
      fs.mkdirSync(skillDirPath, { recursive: true });
      fs.writeFileSync(skillEntryFilePath, entryContent, 'utf-8');

      for (const asset of assets) {
        const sourceAssetPath = path.join(sourceDir, asset);
        const targetAssetPath = path.join(skillDirPath, asset);
        fs.cpSync(sourceAssetPath, targetAssetPath, { recursive: true });
      }

      if (status) {
        syncChanges.push({
          label: `${packName}/${skillName}`,
          status,
        });
      }
    }

    for (const renderedAgent of renderedAgents) {
      const { packName, agentName, filePath, content } = renderedAgent;
      const agentFilePath = path.join(projectPath, filePath);
      const agentDirPath = path.dirname(agentFilePath);

      const before = fs.existsSync(agentFilePath) ? fs.readFileSync(agentFilePath, 'utf-8') : null;

      fs.mkdirSync(agentDirPath, { recursive: true });
      fs.writeFileSync(agentFilePath, content, 'utf-8');

      const status = classifyChange(before, content);
      if (status) {
        syncChanges.push({ label: `${packName}/${agentName}`, status });
      }
    }

    for (const renderedGuideline of renderedGuidelines) {
      if (renderedGuideline.kind === 'rule-file') {
        const { packName, guidelineName, filePath, content } = renderedGuideline;
        const guidelineFilePath = path.join(projectPath, filePath);
        const guidelineDirPath = path.dirname(guidelineFilePath);

        const before = fs.existsSync(guidelineFilePath)
          ? fs.readFileSync(guidelineFilePath, 'utf-8')
          : null;

        fs.mkdirSync(guidelineDirPath, { recursive: true });
        fs.writeFileSync(guidelineFilePath, content, 'utf-8');

        const status = classifyChange(before, content);
        if (status) {
          syncChanges.push({ label: `${packName}/${guidelineName}`, status });
        }
      }
    }

    if (managedBlock) {
      const { filePath, fragments } = managedBlock;
      const blockFilePath = path.join(projectPath, filePath);
      const blockFileDir = path.dirname(blockFilePath);

      const before = fs.existsSync(blockFilePath) ? fs.readFileSync(blockFilePath, 'utf-8') : null;

      const blockContent = buildManagedBlockContent(fragments);
      const content =
        before === null
          ? buildManagedBlock(blockContent)
          : replaceManagedBlock(before, blockContent);

      fs.mkdirSync(blockFileDir, { recursive: true });
      fs.writeFileSync(blockFilePath, content, 'utf-8');

      const status = classifyChange(before, content);
      if (status) {
        syncChanges.push({ label: `${filePath} (managed block)`, status });
      }
    }

    changeSet[tool] = syncChanges;
  }

  const removed = findOrphans(previousItems, currentItems);
  for (const items of Object.values(removed)) {
    for (const item of items) {
      fs.rmSync(path.join(projectPath, item.path), { recursive: true, force: true });
    }
  }

  const removedItemsByTool = Object.entries(removed);
  for (const [tool, removedItems] of removedItemsByTool) {
    const syncChanges = removedItems.map<SyncChange>((removedItem) => ({
      label: removedItem.label,
      status: 'removed',
    }));
    if (changeSet[tool]) {
      changeSet[tool].push(...syncChanges);
    } else {
      changeSet[tool] = syncChanges;
    }
  }

  writeLockfile(projectPath, currentLockfile);

  return changeSet;
}
