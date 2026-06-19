import { afterEach, describe, it, expect } from 'vitest';

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
      guidelines: { rules: { body: 'Be nice.', recommended: { load: 'always' } } },
    },
  },
};

interface Selection {
  skills?: string[];
  agents?: string[];
  guidelines?: Record<string, { load: 'always' }>;
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
});
