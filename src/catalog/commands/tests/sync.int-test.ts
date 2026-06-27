import { afterEach, describe, it, expect } from 'vitest';

import { SyncCommand } from '#catalog/commands/sync.js';
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

const DEFAULT_CATALOG: CatalogSpec = {
  packs: {
    demo: {
      skills: { greet: { instructions: 'Say hi.' } },
      agents: { reviewer: { instructions: 'Review the code.' } },
      guidelines: { rules: { body: 'Always be nice.', recommended: { load: 'always' } } },
    },
  },
};

const DEFAULT_CONFIG: ConfigSpec = {
  tools: ['claude', 'codex'],
  sources: { dev: { type: 'local', path: './catalog' } },
  packs: {
    dev: {
      demo: {
        skills: ['greet'],
        agents: ['reviewer'],
        guidelines: { rules: { load: 'always' } },
      },
    },
  },
};

function setup(catalog: CatalogSpec = DEFAULT_CATALOG, config: ConfigSpec = DEFAULT_CONFIG) {
  const project = createProject();
  projects.push(project);
  writeCatalog(project.projectPath, catalog);
  writeConfig(project.projectPath, config);
  return project;
}

function sync(project: TempProject) {
  return new SyncCommand().execute(project.projectPath);
}

describe('sync (integration)', () => {
  it('installs all three item types for both tools (E1)', () => {
    const project = setup();
    sync(project);

    expect(project.exists('.claude/skills/bolt-dev-demo-greet/SKILL.md')).toBe(true);
    expect(project.read('.claude/skills/bolt-dev-demo-greet/SKILL.md')).toContain('Say hi.');
    expect(project.read('.claude/skills/bolt-dev-demo-greet/SKILL.md')).toContain(
      'name: bolt-dev-demo-greet',
    );
    expect(project.exists('.claude/agents/bolt-dev-demo-reviewer.md')).toBe(true);
    expect(project.exists('.claude/rules/bolt-dev-demo-rules.md')).toBe(true);

    expect(project.exists('.codex/skills/bolt-dev-demo-greet/SKILL.md')).toBe(true);
    expect(project.exists('.codex/agents/bolt-dev-demo-reviewer.toml')).toBe(true);
    expect(project.read('AGENTS.md')).toContain('Always be nice.');
    expect(project.read('AGENTS.md')).toContain('<!-- bolt:start -->');

    expect(project.exists('.agent-bolt/install-lock.json')).toBe(true);
  });

  it('is idempotent: a second sync reports no changes and rewrites nothing (E2)', () => {
    const project = setup();
    sync(project);

    const files = [
      '.claude/skills/bolt-dev-demo-greet/SKILL.md',
      '.claude/agents/bolt-dev-demo-reviewer.md',
      '.claude/rules/bolt-dev-demo-rules.md',
      '.codex/agents/bolt-dev-demo-reviewer.toml',
      'AGENTS.md',
    ];
    const before = files.map((f) => project.read(f));

    const second = sync(project);

    expect(second.every((tool) => tool.changes.length === 0)).toBe(true);
    files.forEach((f, i) => {
      expect(project.read(f)).toBe(before[i]);
    });
  });

  it('throws a clear error when the catalog has no manifest (E14)', () => {
    const project = createProject();
    projects.push(project);
    project.write('.agent-bolt/catalog/packs/.keep', '');
    writeConfig(project.projectPath, DEFAULT_CONFIG);

    expect(() => sync(project)).toThrow(/catalog\.json not found/i);
  });

  it('removes orphaned items when dropped from config, leaving the rest intact (E4)', () => {
    const catalog: CatalogSpec = {
      packs: {
        demo: {
          skills: { greet: { instructions: 'Hi.' }, farewell: { instructions: 'Bye.' } },
        },
      },
    };
    const both: ConfigSpec = {
      tools: ['claude', 'codex'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: { dev: { demo: { skills: ['greet', 'farewell'] } } },
    };
    const project = setup(catalog, both);
    sync(project);
    expect(project.exists('.claude/skills/bolt-dev-demo-farewell/SKILL.md')).toBe(true);

    writeConfig(project.projectPath, {
      ...both,
      packs: { dev: { demo: { skills: ['greet'] } } },
    });
    const result = sync(project);

    expect(project.exists('.claude/skills/bolt-dev-demo-farewell')).toBe(false);
    expect(project.exists('.codex/skills/bolt-dev-demo-farewell')).toBe(false);
    expect(project.exists('.claude/skills/bolt-dev-demo-greet/SKILL.md')).toBe(true);

    const claude = result.find((tool) => tool.tool === 'claude');
    expect(claude?.changes.some((c) => c.label === 'demo/farewell' && c.status === 'removed')).toBe(
      true,
    );
  });

  it('preserves hand-written AGENTS.md content when a guideline is removed (E5)', () => {
    const catalog: CatalogSpec = {
      packs: {
        demo: {
          guidelines: {
            g1: { body: 'G1 body', recommended: { load: 'always' } },
            g2: { body: 'G2 body', recommended: { load: 'always' } },
          },
        },
      },
    };
    const both: ConfigSpec = {
      tools: ['codex'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: { dev: { demo: { guidelines: { g1: { load: 'always' }, g2: { load: 'always' } } } } },
    };
    const project = setup(catalog, both);
    sync(project);

    const top = '# My project\n\nHand-written intro.\n\n';
    const bottom = '\n\n## Hand-written footer\n';
    project.write('AGENTS.md', `${top}${project.read('AGENTS.md')}${bottom}`);

    writeConfig(project.projectPath, {
      ...both,
      packs: { dev: { demo: { guidelines: { g1: { load: 'always' } } } } },
    });
    sync(project);

    const after = project.read('AGENTS.md');
    expect(after.startsWith(top)).toBe(true);
    expect(after.endsWith(bottom)).toBe(true);
    expect(after).toContain('G1 body');
    expect(after).not.toContain('G2 body');
  });

  it('copies directory assets recursively (E8)', () => {
    const catalog: CatalogSpec = {
      packs: {
        demo: {
          skills: {
            greet: {
              instructions: 'Hi.',
              files: { 'refs/a.md': 'AAA', 'refs/b.md': 'BBB' },
              assets: ['refs'],
            },
          },
        },
      },
    };
    const config: ConfigSpec = {
      tools: ['claude'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: { dev: { demo: { skills: ['greet'] } } },
    };
    const project = setup(catalog, config);
    sync(project);

    expect(project.read('.claude/skills/bolt-dev-demo-greet/refs/a.md')).toBe('AAA');
    expect(project.read('.claude/skills/bolt-dev-demo-greet/refs/b.md')).toBe('BBB');
  });

  it('restores an installed file that was edited by hand (E9)', () => {
    const project = setup();
    sync(project);

    project.write('.claude/agents/bolt-dev-demo-reviewer.md', 'corrupted by hand');
    sync(project);

    const restored = project.read('.claude/agents/bolt-dev-demo-reviewer.md');
    expect(restored).not.toBe('corrupted by hand');
    expect(restored).toContain('Review the code.');
  });

  it('renders a conditional guideline with its glob for each tool (E10)', () => {
    const catalog: CatalogSpec = {
      packs: {
        demo: { guidelines: { rules: { body: 'Lint TS.', recommended: { load: 'always' } } } },
      },
    };
    const config: ConfigSpec = {
      tools: ['claude', 'codex', 'cursor', 'copilot'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: {
        dev: { demo: { guidelines: { rules: { load: 'conditional', glob: ['src/**/*.ts'] } } } },
      },
    };
    const project = setup(catalog, config);
    sync(project);

    const rule = project.read('.claude/rules/bolt-dev-demo-rules.md');
    expect(rule).toContain('paths:');
    expect(rule).toContain('src/**/*.ts');

    const agents = project.read('AGENTS.md');
    expect(agents).toMatch(/applies only when/i);
    expect(agents).toContain('`src/**/*.ts`');

    const cursorRule = project.read('.cursor/rules/bolt-dev-demo-rules.mdc');
    expect(cursorRule).toContain('globs: src/**/*.ts');
    expect(cursorRule).toContain('alwaysApply: false');

    const copilotRule = project.read('.github/instructions/bolt-dev-demo-rules.instructions.md');
    expect(copilotRule).toContain('applyTo: src/**/*.ts');
  });

  it('does not create AGENTS.md when there are no guidelines (E11)', () => {
    const catalog: CatalogSpec = {
      packs: {
        demo: { skills: { greet: { instructions: 'Hi.' } }, agents: { reviewer: {} } },
      },
    };
    const config: ConfigSpec = {
      tools: ['claude', 'codex'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: { dev: { demo: { skills: ['greet'], agents: ['reviewer'] } } },
    };
    const project = setup(catalog, config);
    sync(project);

    expect(project.exists('AGENTS.md')).toBe(false);
    expect(project.exists('.codex/agents/bolt-dev-demo-reviewer.toml')).toBe(true);
  });

  it('installs all three item types under .cursor with an .mdc always-rule (E12)', () => {
    const config: ConfigSpec = {
      tools: ['cursor'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: {
        dev: {
          demo: {
            skills: ['greet'],
            agents: ['reviewer'],
            guidelines: { rules: { load: 'always' } },
          },
        },
      },
    };
    const project = setup(DEFAULT_CATALOG, config);
    sync(project);

    expect(project.exists('.cursor/skills/bolt-dev-demo-greet/SKILL.md')).toBe(true);
    expect(project.read('.cursor/skills/bolt-dev-demo-greet/SKILL.md')).toContain('Say hi.');
    expect(project.read('.cursor/skills/bolt-dev-demo-greet/SKILL.md')).toContain(
      'name: bolt-dev-demo-greet',
    );
    expect(project.exists('.cursor/agents/bolt-dev-demo-reviewer.md')).toBe(true);

    const rule = project.read('.cursor/rules/bolt-dev-demo-rules.mdc');
    expect(rule).toContain('alwaysApply: true');
    expect(rule).toContain('Always be nice.');

    expect(project.exists('AGENTS.md')).toBe(false);
  });

  it('writes a cursor conditional rule with unquoted, comma-joined globs (E15)', () => {
    const catalog: CatalogSpec = {
      packs: {
        demo: { guidelines: { rules: { body: 'Lint TS.', recommended: { load: 'always' } } } },
      },
    };
    const config: ConfigSpec = {
      tools: ['cursor'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: {
        dev: {
          demo: { guidelines: { rules: { load: 'conditional', glob: ['**/*.ts', '**/*.tsx'] } } },
        },
      },
    };
    const project = setup(catalog, config);
    sync(project);

    const rule = project.read('.cursor/rules/bolt-dev-demo-rules.mdc');
    expect(rule).toContain('globs: **/*.ts,**/*.tsx');
    expect(rule).not.toContain('globs: "');
  });

  it('installs all three item types under .github with an always instructions file (E13)', () => {
    const config: ConfigSpec = {
      tools: ['copilot'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: {
        dev: {
          demo: {
            skills: ['greet'],
            agents: ['reviewer'],
            guidelines: { rules: { load: 'always' } },
          },
        },
      },
    };
    const project = setup(DEFAULT_CATALOG, config);
    sync(project);

    expect(project.exists('.github/skills/bolt-dev-demo-greet/SKILL.md')).toBe(true);
    expect(project.read('.github/skills/bolt-dev-demo-greet/SKILL.md')).toContain('Say hi.');
    expect(project.read('.github/skills/bolt-dev-demo-greet/SKILL.md')).toContain(
      'name: bolt-dev-demo-greet',
    );
    expect(project.exists('.github/agents/bolt-dev-demo-reviewer.agent.md')).toBe(true);

    const rule = project.read('.github/instructions/bolt-dev-demo-rules.instructions.md');
    expect(rule).toContain('applyTo: "**"');
    expect(rule).toContain('Always be nice.');

    expect(project.exists('AGENTS.md')).toBe(false);
  });
});
