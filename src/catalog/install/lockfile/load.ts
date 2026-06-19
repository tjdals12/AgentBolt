import fs from 'node:fs';
import path from 'node:path';

import { buildInstallLockPath } from '#core/paths.js';
import { LockfileSchema, type Lockfile } from './schema.js';
import type { InstalledItems } from './model.js';

function isWithinProject(projectPath: string, relPath: string): boolean {
  const resolvedPath = path.resolve(projectPath, relPath);
  const relativePath = path.relative(projectPath, resolvedPath);
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function isManagedPath(projectPath: string, relPath: string): boolean {
  const withinProject = isWithinProject(projectPath, relPath);
  const hasInstallPrefix = path.basename(relPath).startsWith('bolt-');
  return withinProject && hasInstallPrefix;
}

function sanitizeItems(projectPath: string, installedItems: InstalledItems): InstalledItems {
  const sanitized: InstalledItems = {};
  const installedItemsByTool = Object.entries(installedItems);
  for (const [tool, items] of installedItemsByTool) {
    sanitized[tool] = items.filter((item) => isManagedPath(projectPath, item.path));
  }
  return sanitized;
}

export function loadLockfile(projectPath: string): Lockfile {
  const lockfilePath = buildInstallLockPath(projectPath);

  let raw: unknown;
  try {
    const file = fs.readFileSync(lockfilePath, 'utf-8');
    raw = JSON.parse(file);
  } catch {
    return { installedItems: {} };
  }

  const parsed = LockfileSchema.safeParse(raw);
  if (parsed.error) {
    return { installedItems: {} };
  }

  const lockfile = parsed.data;

  return {
    installedItems: sanitizeItems(projectPath, lockfile.installedItems),
  };
}
