import path from 'node:path';
import fs from 'node:fs';

import type { ChangeStatus, RenderedSkill } from './model.js';

export function classifyChange(before: string | null, current: string): ChangeStatus | null {
  if (before === null) return 'installed';
  if (before !== current) return 'updated';
  return null;
}

function walkFiles(root: string): string[] {
  const filePaths: string[] = [];

  const walk = (dir: string, prefix: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const relPath = prefix ? path.join(prefix, entry.name) : entry.name;

      if (entry.isDirectory()) {
        walk(entryPath, relPath);
      } else if (entry.isFile()) {
        filePaths.push(relPath);
      }
    }
  };

  walk(root, '');
  return filePaths;
}

function collectDesiredFiles(renderedSkill: RenderedSkill): Map<string, string> {
  const { entryFileName, entryContent, sourceDir, assets } = renderedSkill;

  const files = new Map<string, string>();
  files.set(entryFileName, entryContent);

  for (const asset of assets) {
    const assetSourcePath = path.join(sourceDir, asset);
    const isDirectoryAsset = fs.statSync(assetSourcePath).isDirectory();

    if (isDirectoryAsset) {
      const assetFiles = walkFiles(assetSourcePath);
      for (const relPath of assetFiles) {
        const fileSourcePath = path.join(assetSourcePath, relPath);
        const fileContent = fs.readFileSync(fileSourcePath, 'utf-8');
        const installPath = path.join(asset, relPath);
        files.set(installPath, fileContent);
      }
    } else {
      const fileContent = fs.readFileSync(assetSourcePath, 'utf-8');
      files.set(asset, fileContent);
    }
  }

  return files;
}

function collectInstalledFiles(skillDirPath: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const relPath of walkFiles(skillDirPath)) {
    files.set(relPath, fs.readFileSync(path.join(skillDirPath, relPath), 'utf-8'));
  }
  return files;
}

function isUpToDate(desired: Map<string, string>, installed: Map<string, string>): boolean {
  if (desired.size !== installed.size) return false;
  for (const [relPath, content] of desired) {
    if (installed.get(relPath) !== content) return false;
  }
  return true;
}

export function classifySkill(
  projectPath: string,
  renderedSkill: RenderedSkill,
): ChangeStatus | null {
  const { dir, entryFileName } = renderedSkill;
  const skillDirPath = path.join(projectPath, dir);
  const entryFilePath = path.join(skillDirPath, entryFileName);

  if (!fs.existsSync(entryFilePath)) {
    return 'installed';
  }

  const desired = collectDesiredFiles(renderedSkill);
  const installed = collectInstalledFiles(skillDirPath);
  return isUpToDate(desired, installed) ? null : 'updated';
}
