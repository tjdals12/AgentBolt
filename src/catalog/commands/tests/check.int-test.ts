import { afterEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { SyncCommand } from '#catalog/commands/sync.js';
import { CheckCommand } from '#catalog/commands/check.js';
import {
  createProject,
  writeCatalog,
  writeConfig,
  type CatalogSpec,
  type ConfigSpec,
  type TempProject,
} from './project-fixture.js';

const projects: TempProject[] = [];

afterEach(() => {
  while (projects.length > 0) {
    projects.pop()?.cleanup();
  }
});

const CATALOG: CatalogSpec = {
  packs: {
    demo: {
      skills: { greet: { instructions: 'Say hi.' }, farewell: { instructions: 'Say bye.' } },
      agents: { reviewer: { instructions: 'Review.' } },
      guidelines: {
        rules: {
          body: 'Be nice.',
          usage: 'Read before editing code.',
          recommended: { load: 'always' },
        },
      },
    },
  },
};

interface Selection {
  skills?: string[];
  agents?: string[];
  guidelines?: Record<string, { load: 'always' } | { load: 'reference'; path: string }>;
}

function config(selection: Selection): ConfigSpec {
  return {
    tools: ['claude'],
    sources: { dev: { type: 'local', path: './catalog' } },
    packs: { dev: { demo: selection } },
  };
}

const FULL: Selection = {
  skills: ['greet'],
  agents: ['reviewer'],
  guidelines: { rules: { load: 'always' } },
};

function setup(selection: Selection = FULL) {
  const project = createProject();
  projects.push(project);
  writeCatalog(project.projectPath, CATALOG);
  writeConfig(project.projectPath, config(selection));
  return project;
}

function check(project: TempProject) {
  return new CheckCommand().execute(project.projectPath);
}

function claudeChanges(project: TempProject) {
  return check(project).checkResult.find((tool) => tool.tool === 'claude')?.changes ?? [];
}

describe('check (integration)', () => {
  it('detects reference body and list drift without changing files or the lock', () => {
    const project = setup({ guidelines: { rules: { load: 'reference', path: 'docs' } } });
    new SyncCommand().execute(project.projectPath);
    const lockBefore = project.read('.agent-bolt/install-lock.json');
    const lockMtime = project.mtimeMs('.agent-bolt/install-lock.json');
    project.write('docs/bolt-dev-demo-rules.md', 'Edited body.');
    project.write(
      'CLAUDE.md',
      project.read('CLAUDE.md').replace('Read before editing code.', 'Edited usage.'),
    );
    const instructionsBefore = project.read('CLAUDE.md');

    const result = check(project);
    expect(result.drifted).toBe(true);
    expect(result.checkResult[0]?.changes).toEqual(
      expect.arrayContaining([
        { source: 'dev', label: 'demo/rules', status: 'updated' },
        { source: null, label: 'CLAUDE.md (managed block)', status: 'updated' },
      ]),
    );
    expect(project.read('docs/bolt-dev-demo-rules.md')).toBe('Edited body.');
    expect(project.read('CLAUDE.md')).toBe(instructionsBefore);

    const referenceFilePath = path.join(project.projectPath, 'docs/bolt-dev-demo-rules.md');
    fs.unlinkSync(referenceFilePath);
    expect(claudeChanges(project)).toContainEqual({
      source: 'dev',
      label: 'demo/rules',
      status: 'installed',
    });
    expect(project.exists('docs/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('.agent-bolt/install-lock.json')).toBe(lockBefore);
    expect(project.mtimeMs('.agent-bolt/install-lock.json')).toBe(lockMtime);
  });

  it('reports clean immediately after a sync (E3)', () => {
    const project = setup();
    new SyncCommand().execute(project.projectPath);

    expect(check(project).drifted).toBe(false);
  });

  it('detects an item present in config but not installed — missing (E6-missing)', () => {
    const project = setup();
    new SyncCommand().execute(project.projectPath);

    writeConfig(project.projectPath, config({ ...FULL, skills: ['greet', 'farewell'] }));

    expect(check(project).drifted).toBe(true);
    expect(
      claudeChanges(project).some((c) => c.label === 'demo/farewell' && c.status === 'installed'),
    ).toBe(true);
  });

  it('detects an installed file whose content changed — drifted (E6-drifted)', () => {
    const project = setup();
    new SyncCommand().execute(project.projectPath);

    project.write('.claude/skills/bolt-dev-demo-greet/SKILL.md', 'tampered');

    expect(check(project).drifted).toBe(true);
    expect(
      claudeChanges(project).some((c) => c.label === 'demo/greet' && c.status === 'updated'),
    ).toBe(true);
  });

  it('detects an installed item removed from config — orphaned (E6-orphaned)', () => {
    const project = setup();
    new SyncCommand().execute(project.projectPath);

    writeConfig(project.projectPath, config({ ...FULL, agents: [] }));

    expect(check(project).drifted).toBe(true);
    expect(
      claudeChanges(project).some((c) => c.label === 'demo/reviewer' && c.status === 'removed'),
    ).toBe(true);
  });

  it('does not write anything to disk (E7)', () => {
    const project = setup();
    new SyncCommand().execute(project.projectPath);

    const lockBefore = project.read('.agent-bolt/install-lock.json');
    const lockMtime = project.mtimeMs('.agent-bolt/install-lock.json');
    const skillBefore = project.read('.claude/skills/bolt-dev-demo-greet/SKILL.md');

    check(project);

    expect(project.read('.agent-bolt/install-lock.json')).toBe(lockBefore);
    expect(project.mtimeMs('.agent-bolt/install-lock.json')).toBe(lockMtime);
    expect(project.read('.claude/skills/bolt-dev-demo-greet/SKILL.md')).toBe(skillBefore);
  });

  it('reports clean for Codex and OpenCode sharing AGENTS.md after a sync (E18)', () => {
    const project = createProject();
    projects.push(project);
    writeCatalog(project.projectPath, CATALOG);
    writeConfig(project.projectPath, {
      tools: ['codex', 'opencode'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: { dev: { demo: { agents: ['reviewer'], guidelines: { rules: { load: 'always' } } } } },
    });
    new SyncCommand().execute(project.projectPath);

    expect(check(project).drifted).toBe(false);
  });
});
