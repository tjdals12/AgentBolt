import { afterEach, describe, it, expect } from 'vitest';

import { SkillInstallCommand } from '#catalog/commands/skill-install.js';
import { createProject, type TempProject, writeConfig } from './project-fixture.js';

const projects: TempProject[] = [];

afterEach(() => {
  while (projects.length > 0) {
    projects.pop()?.cleanup();
  }
});

describe('skill install', () => {
  it('installs the agent-bolt skill into every configured tool', () => {
    const project = createProject();
    projects.push(project);
    writeConfig(project.projectPath, { tools: ['claude', 'codex'], sources: {}, packs: {} });

    const result = new SkillInstallCommand().execute(project.projectPath, '9.9.9');

    expect(result).toEqual({
      skill: 'agent-bolt',
      version: '9.9.9',
      tools: [
        { tool: 'claude', path: '.claude/skills/agent-bolt', status: 'installed' },
        { tool: 'codex', path: '.codex/skills/agent-bolt', status: 'installed' },
      ],
    });
    for (const dir of ['.claude/skills', '.codex/skills']) {
      const entry = project.read(`${dir}/agent-bolt/SKILL.md`);
      expect(entry.startsWith('---\nversion: 9.9.9\n')).toBe(true);
    }
  });
});
