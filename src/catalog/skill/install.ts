import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { ToolId } from '#catalog/tool/model.js';
import { getAdapters } from '#catalog/install/adapters/registry.js';

const SKILL_ENTRY_FILENAME = 'SKILL.md';

export type ToolSkillInstall = {
  tool: ToolId;
  path: string;
  status: 'installed' | 'updated';
};

export function resolveBundledSkillDir(name: string): string {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve('../../../package.json');
  const skillDir = path.join(path.dirname(packageJsonPath), 'skills', name);

  if (!fs.existsSync(path.join(skillDir, SKILL_ENTRY_FILENAME))) {
    throw new Error(
      `Bundled skill '${name}' not found at ${skillDir}. Reinstall @tjdals12/agent-bolt.`,
    );
  }

  return skillDir;
}

export function installBundledSkill(args: {
  projectPath: string;
  toolIds: ToolId[];
  name: string;
  version: string;
}): ToolSkillInstall[] {
  const { projectPath, toolIds, name, version } = args;

  const skillDir = resolveBundledSkillDir(name);
  const adapters = getAdapters(toolIds);
  const installs: ToolSkillInstall[] = [];

  for (const adapter of adapters) {
    const { id, skillsDir } = adapter;

    const installPath = path.join(skillsDir, name);
    const targetDir = path.join(projectPath, installPath);
    const status = fs.existsSync(targetDir) ? 'updated' : 'installed';

    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(skillDir, targetDir, { recursive: true });
    stampVersion(path.join(targetDir, SKILL_ENTRY_FILENAME), version);

    installs.push({ tool: id, path: installPath, status });
  }

  return installs;
}

function stampVersion(skillFilePath: string, version: string): void {
  const content = fs.readFileSync(skillFilePath, 'utf-8');
  if (!content.startsWith('---\n')) {
    return;
  }
  fs.writeFileSync(skillFilePath, content.replace('---\n', `---\nversion: ${version}\n`), 'utf-8');
}
