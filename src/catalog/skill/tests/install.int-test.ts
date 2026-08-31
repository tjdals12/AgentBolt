import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { installBundledSkill, resolveBundledSkillDir } from '#catalog/skill/install.js';

let projectPath: string;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bolt-skill-it-'));
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe('resolveBundledSkillDir', () => {
  it('returns the directory of a bundled skill', () => {
    const skillDir = resolveBundledSkillDir('agent-bolt');
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
  });

  it('rejects a skill that is not bundled', () => {
    expect(() => resolveBundledSkillDir('not-bundled')).toThrow(
      "Bundled skill 'not-bundled' not found",
    );
  });
});

describe('installBundledSkill', () => {
  it('copies the skill into every tool skills dir and stamps the version', () => {
    const installs = installBundledSkill({
      projectPath,
      toolIds: ['claude', 'codex'],
      name: 'agent-bolt',
      version: '9.9.9',
    });

    expect(installs).toEqual([
      { tool: 'claude', path: '.claude/skills/agent-bolt', status: 'installed' },
      { tool: 'codex', path: '.codex/skills/agent-bolt', status: 'installed' },
    ]);

    for (const { path: installPath } of installs) {
      const skillDir = path.join(projectPath, installPath);
      const entry = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
      expect(entry.startsWith('---\nversion: 9.9.9\nname: agent-bolt\n')).toBe(true);
      expect(fs.existsSync(path.join(skillDir, 'references', 'json-responses.md'))).toBe(true);
    }
  });

  it('overwrites an existing install, drops stale files, and reports updated', () => {
    installBundledSkill({ projectPath, toolIds: ['claude'], name: 'agent-bolt', version: '1.0.0' });
    const staleFilePath = path.join(projectPath, '.claude/skills/agent-bolt', 'stale.md');
    fs.writeFileSync(staleFilePath, 'stale');

    const installs = installBundledSkill({
      projectPath,
      toolIds: ['claude'],
      name: 'agent-bolt',
      version: '1.0.1',
    });

    expect(installs).toEqual([
      { tool: 'claude', path: '.claude/skills/agent-bolt', status: 'updated' },
    ]);
    expect(fs.existsSync(staleFilePath)).toBe(false);
    const entry = fs.readFileSync(
      path.join(projectPath, '.claude/skills/agent-bolt', 'SKILL.md'),
      'utf-8',
    );
    expect(entry).toContain('version: 1.0.1');
    expect(entry).not.toContain('version: 1.0.0');
  });
});
