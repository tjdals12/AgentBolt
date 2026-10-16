import { afterEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { SyncCommand } from '#catalog/commands/sync.js';
import { CheckCommand } from '#catalog/commands/check.js';
import { AddPackCommand } from '#catalog/commands/add-pack.js';
import { AddItemCommand } from '#catalog/commands/add-item.js';
import { ListItemsCommand } from '#catalog/commands/list-items.js';
import { ShowItemCommand } from '#catalog/commands/show-item.js';
import { loadConfig } from '#catalog/config/load.js';
import type { GuidelineSelection } from '#catalog/config/schema.js';
import { buildCatalogConfigPath } from '#core/paths.js';
import { ProgressReporter } from '#core/progress.js';
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
  const { toolSyncResults } = new SyncCommand().execute(project.projectPath);
  return toolSyncResults;
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
    expect(project.exists('.claude/rules/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('CLAUDE.md')).toContain('Always be nice.');

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
      'CLAUDE.md',
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

    writeConfig(project.projectPath, { ...both, packs: {} });
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(true);
    expect(project.read('AGENTS.md')).toBe(after);
    sync(project);

    const cleared = project.read('AGENTS.md');
    expect(cleared.startsWith(top)).toBe(true);
    expect(cleared.endsWith(bottom)).toBe(true);
    expect(cleared).not.toContain('G1 body');
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
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

    project.write('AGENTS.md', '# User instructions without bolt markers');
    sync(project);
    expect(project.read('AGENTS.md')).toBe('# User instructions without bolt markers');
  });

  it('installs Cursor assets with always guidelines in AGENTS.md (E12)', () => {
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

    const rule = project.read('AGENTS.md');
    expect(rule).toContain('<!-- bolt:start -->');
    expect(rule).toContain('Always be nice.');

    expect(project.exists('.cursor/rules/bolt-dev-demo-rules.mdc')).toBe(false);
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

  it('installs Copilot assets with always guidelines in repository instructions (E13)', () => {
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

    const rule = project.read('.github/copilot-instructions.md');
    expect(rule).toContain('<!-- bolt:start -->');
    expect(rule).toContain('Always be nice.');

    expect(project.exists('.github/instructions/bolt-dev-demo-rules.instructions.md')).toBe(false);
    expect(project.exists('AGENTS.md')).toBe(false);
  });

  it('installs all three item types under .opencode with an AGENTS.md block (E16)', () => {
    const config: ConfigSpec = {
      tools: ['opencode'],
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

    expect(project.exists('.opencode/skills/bolt-dev-demo-greet/SKILL.md')).toBe(true);
    expect(project.read('.opencode/skills/bolt-dev-demo-greet/SKILL.md')).toContain('Say hi.');
    expect(project.read('.opencode/skills/bolt-dev-demo-greet/SKILL.md')).toContain(
      'name: bolt-dev-demo-greet',
    );

    const agent = project.read('.opencode/agents/bolt-dev-demo-reviewer.md');
    expect(agent).toContain('mode: subagent');
    expect(agent).toContain('Review the code.');

    const agents = project.read('AGENTS.md');
    expect(agents).toContain('Always be nice.');
    expect(agents).toContain('<!-- bolt:start -->');
  });

  it('shares one AGENTS.md block across Cursor, Codex, and OpenCode (E17)', () => {
    const config: ConfigSpec = {
      tools: ['cursor', 'codex', 'opencode'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: {
        dev: { demo: { agents: ['reviewer'], guidelines: { rules: { load: 'always' } } } },
      },
    };
    const project = setup(DEFAULT_CATALOG, config);
    const result = sync(project);

    expect(project.exists('.codex/agents/bolt-dev-demo-reviewer.toml')).toBe(true);
    expect(project.exists('.opencode/agents/bolt-dev-demo-reviewer.md')).toBe(true);

    const agents = project.read('AGENTS.md');
    expect(agents.split('<!-- bolt:start -->').length - 1).toBe(1);
    expect(agents.split('<!-- bolt:end -->').length - 1).toBe(1);
    expect(agents.split('Always be nice.').length - 1).toBe(1);

    const codex = result.find((tool) => tool.tool === 'codex');
    const opencode = result.find((tool) => tool.tool === 'opencode');
    expect(codex?.changes.some((c) => c.label.includes('AGENTS.md'))).toBe(true);
    expect(opencode?.changes.some((c) => c.label.includes('AGENTS.md'))).toBe(true);

    const second = sync(project);
    expect(second.every((tool) => tool.changes.length === 0)).toBe(true);
    writeConfig(project.projectPath, { ...config, tools: [], packs: {} });
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(true);
    sync(project);
    expect(project.read('AGENTS.md')).not.toContain('Always be nice.');
    const afterCleanup = sync(project);
    expect(afterCleanup.every(({ changes }) => changes.length === 0)).toBe(true);
  });
});

const REFERENCE_CATALOG: CatalogSpec = {
  packs: {
    demo: {
      skills: { greet: { instructions: 'Say hi.' } },
      guidelines: {
        rules: { body: '# Detailed rules\n', usage: 'Read before editing code.' },
        inline: { body: '# Always included\n' },
      },
    },
    testing: {
      guidelines: { tests: { body: '# Testing rules\n', usage: 'Read before writing tests.' } },
    },
  },
};

const REFERENCE_CONFIG: ConfigSpec = {
  tools: ['claude', 'codex'],
  sources: { dev: { type: 'local', path: './catalog' } },
  packs: { dev: { demo: { guidelines: { rules: { load: 'reference', path: 'docs' } } } } },
};

describe('reference guidelines (integration)', () => {
  it.each([
    { command: 'add-pack', existingPack: false },
    { command: 'add-item', existingPack: false },
    { command: 'add-item', existingPack: true },
  ])(
    'installs the catalog-recommended directory through $command (existing pack: $existingPack)',
    async ({ command, existingPack }) => {
      const catalog: CatalogSpec = {
        packs: {
          demo: {
            guidelines: {
              rules: {
                body: '# Detailed rules\n',
                recommended: { load: 'reference', path: 'team/policies' },
              },
            },
          },
        },
      };
      const config: ConfigSpec = {
        ...REFERENCE_CONFIG,
        packs: existingPack ? { dev: { demo: {} } } : {},
      };
      const project = setup(catalog, config);
      const reporter = ProgressReporter.create({ silent: true });

      if (command === 'add-pack') {
        const addPackCommand = new AddPackCommand({
          source: 'dev',
          packs: 'demo',
          json: true,
        });
        await addPackCommand.execute(project.projectPath, reporter);
      } else {
        const addItemCommand = new AddItemCommand({
          source: 'dev',
          pack: 'demo',
          guidelines: 'rules',
          json: true,
        });
        await addItemCommand.execute(project.projectPath, reporter);
      }

      const configPath = buildCatalogConfigPath(project.projectPath);
      const savedConfig = loadConfig(configPath);
      expect(savedConfig.packs.dev?.demo?.guidelines.rules).toEqual({
        load: 'reference',
        path: 'team/policies',
      });

      sync(project);

      expect(project.read('team/policies/bolt-dev-demo-rules.md')).toBe('# Detailed rules\n');
      expect(project.read('CLAUDE.md')).toContain('[rules](team/policies/bolt-dev-demo-rules.md)');
      expect(project.read('AGENTS.md')).toContain('[rules](team/policies/bolt-dev-demo-rules.md)');
      expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
    },
  );

  it('shares body files across tools and collects references before always content', () => {
    const project = setup(REFERENCE_CATALOG, {
      ...REFERENCE_CONFIG,
      tools: ['claude', 'cursor', 'codex', 'copilot', 'opencode'],
      packs: {
        dev: {
          demo: {
            guidelines: {
              inline: { load: 'always' },
              rules: { load: 'reference', path: 'docs/database rules' },
            },
          },
          testing: { guidelines: { tests: { load: 'reference', path: 'docs/database rules' } } },
        },
      },
    });
    const result = sync(project);

    expect(project.read('docs/database rules/bolt-dev-demo-rules.md')).toBe('# Detailed rules\n');
    expect(project.read('docs/database rules/bolt-dev-testing-tests.md')).toBe('# Testing rules\n');
    for (const file of ['CLAUDE.md', 'AGENTS.md', '.github/copilot-instructions.md']) {
      const content = project.read(file);
      const prefix = file.startsWith('.github/') ? '../' : '';
      expect(content.split('# Referenced guidelines')).toHaveLength(2);
      expect(content).toContain(
        `- [rules](${prefix}docs/database%20rules/bolt-dev-demo-rules.md): Read before editing code.`,
      );
      expect(content).toContain(
        `- [tests](${prefix}docs/database%20rules/bolt-dev-testing-tests.md): Read before writing tests.`,
      );
      expect(content.indexOf('# Referenced guidelines')).toBeLessThan(
        content.indexOf('# Always included'),
      );
      expect(content).not.toContain('# Detailed rules');
      expect(content).not.toContain('# Testing rules');
    }
    for (const tool of result) {
      expect(tool.changes).toContainEqual({
        source: 'dev',
        label: 'demo/rules',
        status: 'installed',
      });
    }
    expect(sync(project).every(({ changes }) => changes.length === 0)).toBe(true);
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
  });

  it('handles path changes, shared ownership, mode changes, and final reference removal', () => {
    const project = setup(REFERENCE_CATALOG, REFERENCE_CONFIG);
    sync(project);
    project.write('CLAUDE.md', `Keep this intro.\n${project.read('CLAUDE.md')}\nKeep this footer.`);

    const moved: ConfigSpec = {
      ...REFERENCE_CONFIG,
      packs: {
        dev: { demo: { guidelines: { rules: { load: 'reference', path: 'docs/moved' } } } },
      },
    };
    writeConfig(project.projectPath, moved);
    const lockBefore = project.read('.agent-bolt/install-lock.json');
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(true);
    expect(project.exists('docs/moved/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('.agent-bolt/install-lock.json')).toBe(lockBefore);
    sync(project);
    expect(project.exists('docs/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('docs/moved/bolt-dev-demo-rules.md')).toBe('# Detailed rules\n');

    writeConfig(project.projectPath, { ...moved, tools: ['codex'] });
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(true);
    sync(project);
    expect(project.exists('docs/moved/bolt-dev-demo-rules.md')).toBe(true);
    expect(project.read('CLAUDE.md')).not.toContain('Referenced guidelines');
    expect(project.read('CLAUDE.md')).toMatch(/^Keep this intro\.[\s\S]*Keep this footer\.$/);
    expect(project.read('AGENTS.md')).toContain('[rules](docs/moved/bolt-dev-demo-rules.md)');

    writeConfig(project.projectPath, {
      ...moved,
      tools: ['codex'],
      packs: { dev: { demo: { guidelines: { rules: { load: 'always' } } } } },
    });
    sync(project);
    expect(project.exists('docs/moved/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('AGENTS.md')).toContain('# Detailed rules');
    expect(project.read('AGENTS.md')).not.toContain('Referenced guidelines');

    writeConfig(project.projectPath, { ...moved, tools: ['codex'] });
    sync(project);
    writeConfig(project.projectPath, { ...moved, tools: [], packs: {} });
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(true);
    sync(project);
    expect(project.exists('docs/moved/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('AGENTS.md')).not.toContain('Referenced guidelines');
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
  });

  it('keeps conditional output working when switching to and from reference', () => {
    const config: ConfigSpec = {
      ...REFERENCE_CONFIG,
      tools: ['claude', 'codex', 'cursor', 'copilot', 'opencode'],
    };
    const project = setup(REFERENCE_CATALOG, config);
    sync(project);

    writeConfig(project.projectPath, {
      ...config,
      packs: {
        dev: {
          demo: {
            guidelines: { rules: { load: 'conditional', glob: ['src/**/*.ts'] } },
          },
        },
      },
    });
    sync(project);
    const rulePaths = [
      '.claude/rules/bolt-dev-demo-rules.md',
      '.cursor/rules/bolt-dev-demo-rules.mdc',
      '.github/instructions/bolt-dev-demo-rules.instructions.md',
    ];
    expect(project.exists('docs/bolt-dev-demo-rules.md')).toBe(false);
    for (const rulePath of rulePaths) expect(project.read(rulePath)).toContain('src/**/*.ts');
    expect(project.read('AGENTS.md')).toContain('applies only when');
    expect(project.read('CLAUDE.md')).not.toContain('Referenced guidelines');

    writeConfig(project.projectPath, config);
    sync(project);
    for (const rulePath of rulePaths) expect(project.exists(rulePath)).toBe(false);
    expect(project.read('AGENTS.md')).not.toContain('applies only when');
    expect(project.read('docs/bolt-dev-demo-rules.md')).toBe('# Detailed rules\n');
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
  });

  it.each([
    {
      usage: undefined,
      projectUsage: undefined,
      warnings: [
        `Guideline 'dev/demo/rules' is missing usage.

  Using fallback text: "Read this guideline before performing related work."

  Set usage in .agent-bolt/catalog-config.yml to customize this text:
    packs.dev.demo.guidelines.rules.usage`,
      ],
    },
    {
      usage: 'Read this guideline before performing related work.',
      projectUsage: undefined,
      warnings: [],
    },
    { usage: undefined, projectUsage: 'Read the project policy before editing.', warnings: [] },
  ])(
    'handles catalog usage $usage and project usage $projectUsage',
    ({ usage, projectUsage, warnings }) => {
      const project = setup(REFERENCE_CATALOG, {
        ...REFERENCE_CONFIG,
        tools: ['claude', 'codex', 'cursor', 'copilot', 'opencode'],
        packs: {
          dev: {
            demo: {
              guidelines: { rules: { load: 'reference', path: 'docs', usage: projectUsage } },
            },
          },
        },
      });
      const guidelineManifestPath =
        '.agent-bolt/catalog/packs/demo/guidelines/rules/guideline.json';
      const guidelineManifest = {
        name: 'rules',
        description: 'rules guideline',
        body: './content.md',
        recommended: { load: 'always' },
        usage,
      };
      const guidelineManifestContent = JSON.stringify(guidelineManifest);
      project.write(guidelineManifestPath, guidelineManifestContent);

      const fallbackUsage = 'Read this guideline before performing related work.';
      const listItemsResult = new ListItemsCommand({}).execute(project.projectPath);
      const demoPack = listItemsResult.sourceCatalogs[0]?.packs.find(({ name }) => name === 'demo');
      expect(listItemsResult.failures).toEqual([]);
      expect(demoPack?.items.guidelines).toContainEqual(
        expect.objectContaining({ name: 'rules', usage }),
      );

      const showCommand = new ShowItemCommand({ source: 'dev', pack: 'demo', item: 'rules' });
      const shownItems = showCommand.toJson(showCommand.execute(project.projectPath)).items;
      const shownGuideline = shownItems.find((item) => item.type === 'guideline');
      expect(shownGuideline?.usage).toBe(usage);
      if (usage === undefined) {
        expect(JSON.stringify(shownGuideline)).not.toContain('"usage"');
      }

      const result = new SyncCommand().execute(project.projectPath);
      expect(result.warnings).toEqual(warnings);

      for (const [instructionFile, link] of [
        ['CLAUDE.md', 'docs/bolt-dev-demo-rules.md'],
        ['AGENTS.md', 'docs/bolt-dev-demo-rules.md'],
        ['.github/copilot-instructions.md', '../docs/bolt-dev-demo-rules.md'],
      ] as const) {
        const instructionContent = project.read(instructionFile);
        expect(instructionContent).toContain(
          `- [rules](${link}): ${projectUsage ?? fallbackUsage}`,
        );
      }
      expect(project.read(guidelineManifestPath)).toBe(guidelineManifestContent);
      expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
    },
  );

  it.each<GuidelineSelection>([{ load: 'always' }, { load: 'conditional', glob: ['src/**/*.ts'] }])(
    'does not warn about missing usage for $load installations',
    (selection) => {
      const project = setup(REFERENCE_CATALOG, {
        ...REFERENCE_CONFIG,
        packs: { dev: { demo: { guidelines: { rules: selection } } } },
      });
      project.write(
        '.agent-bolt/catalog/packs/demo/guidelines/rules/guideline.json',
        JSON.stringify({
          name: 'rules',
          description: 'rules guideline',
          body: './content.md',
          recommended: { load: 'always' },
        }),
      );

      const result = new SyncCommand().execute(project.projectPath);

      expect(result.warnings).toEqual([]);
      expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
    },
  );

  it('rejects empty usage before writing files', () => {
    const project = setup(
      {
        packs: {
          demo: {
            skills: { greet: {} },
            guidelines: { rules: {} },
          },
        },
      },
      {
        ...REFERENCE_CONFIG,
        packs: {
          dev: {
            demo: {
              skills: ['greet'],
              guidelines: { rules: { load: 'reference', path: 'docs' } },
            },
          },
        },
      },
    );
    const guidelineManifest = {
      name: 'rules',
      description: 'rules guideline',
      body: './content.md',
      recommended: { load: 'always' },
      usage: '',
    };
    const guidelineManifestContent = JSON.stringify(guidelineManifest);
    project.write(
      '.agent-bolt/catalog/packs/demo/guidelines/rules/guideline.json',
      guidelineManifestContent,
    );
    expect(() => sync(project)).toThrow(/guideline\.json[\s\S]*usage/);
    expect(() => new CheckCommand().execute(project.projectPath)).toThrow(/usage/);
    expect(project.exists('.claude/skills/bolt-dev-demo-greet')).toBe(false);
    expect(project.exists('docs/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.exists('.agent-bolt/install-lock.json')).toBe(false);
  });

  it('uses Bolt filenames and preserves unrelated files when changing directories', () => {
    const project = setup(REFERENCE_CATALOG, REFERENCE_CONFIG);
    project.write('docs/rules.md', 'User-owned content.');
    sync(project);
    expect(project.read('docs/rules.md')).toBe('User-owned content.');
    expect(project.read('docs/bolt-dev-demo-rules.md')).toBe('# Detailed rules\n');

    writeConfig(project.projectPath, {
      ...REFERENCE_CONFIG,
      packs: { dev: { demo: { guidelines: { rules: { load: 'reference', path: '.' } } } } },
    });
    sync(project);
    expect(project.exists('docs/bolt-dev-demo-rules.md')).toBe(false);
    expect(project.read('bolt-dev-demo-rules.md')).toBe('# Detailed rules\n');
    expect(project.read('docs/rules.md')).toBe('User-owned content.');
  });

  it.each(['../outside', '/tmp/outside'])(
    'rejects reference directories outside the project (%s)',
    (directoryPath) => {
      const project = setup(REFERENCE_CATALOG, {
        ...REFERENCE_CONFIG,
        packs: {
          dev: {
            demo: {
              guidelines: { rules: { load: 'reference', path: directoryPath } },
            },
          },
        },
      });
      expect(() => sync(project)).toThrow(/Reference directory/);
      expect(project.exists('CLAUDE.md')).toBe(false);
    },
  );

  it('rejects reference directories that leave the project through a symlink', () => {
    const project = setup(REFERENCE_CATALOG, REFERENCE_CONFIG);
    const outside = createProject();
    projects.push(outside);
    outside.write('rules.md', 'Outside content.');
    const referenceDirectoryPath = path.join(project.projectPath, 'docs');
    fs.symlinkSync(outside.projectPath, referenceDirectoryPath, 'dir');

    expect(() => sync(project)).toThrow(/inside the project/);
    expect(outside.read('rules.md')).toBe('Outside content.');
    expect(project.exists('CLAUDE.md')).toBe(false);
  });
});
