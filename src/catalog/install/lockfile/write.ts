import path from 'node:path';
import fs from 'node:fs';

import { buildInstallLockPath } from '#core/paths.js';

import type { Lockfile } from './schema.js';
import type { InstalledItems } from './model.js';

export function buildLockfile(installedItems: InstalledItems): Lockfile {
  return { installedItems };
}

export function writeLockfile(projectPath: string, lockfile: Lockfile): void {
  const lockfilePath = buildInstallLockPath(projectPath);
  const lockfileDirPath = path.dirname(lockfilePath);
  fs.mkdirSync(lockfileDirPath, { recursive: true });
  fs.writeFileSync(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`, 'utf-8');
}
