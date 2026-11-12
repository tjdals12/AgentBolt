import { afterEach, describe, expect, it } from 'vitest';
import { format } from 'prettier';

import { SyncCommand } from '#catalog/commands/sync.js';
import { CheckCommand } from '#catalog/commands/check.js';
import { TOOL_IDS } from '#catalog/tool/model.js';
import { createProject, writeCatalog, writeConfig, type TempProject } from './project-fixture.js';

const projects: TempProject[] = [];

afterEach(() => {
  while (projects.length > 0) projects.pop()?.cleanup();
});

describe('installed Markdown newlines', () => {
  it('normalizes existing file endings when no content follows the end marker', async () => {
    const project = createProject();
    projects.push(project);
    writeCatalog(project.projectPath, {
      packs: { demo: { guidelines: { example: { body: 'Example body.\n' } } } },
    });
    writeConfig(project.projectPath, {
      tools: ['claude', 'codex', 'copilot'],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: { dev: { demo: { guidelines: { example: { load: 'always' } } } } },
    });
    const files = ['CLAUDE.md', 'AGENTS.md', '.github/copilot-instructions.md'];
    for (const file of files) {
      project.write(file, '<!-- bolt:start -->\nold\n<!-- bolt:end -->\n\n\n\n\n');
    }

    new SyncCommand().execute(project.projectPath);

    for (const file of files) {
      const installed = project.read(file);
      expect(installed).toMatch(/<!-- bolt:end -->\n$/);
      expect(await format(installed, { parser: 'markdown' })).toBe(installed);
    }
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
    const { toolSyncResults } = new SyncCommand().execute(project.projectPath);
    expect(toolSyncResults.every(({ changes }) => changes.length === 0)).toBe(true);
  });

  it.each(
    [
      { scenario: 'no final newline', ending: '' },
      { scenario: 'one final newline', ending: '\n' },
      { scenario: 'multiple final newlines', ending: '\n\n\n' },
      { scenario: 'CRLF at the end', ending: '\r\n' },
    ].flatMap((source) =>
      (['always', 'conditional'] as const).map((load) => ({ ...source, load })),
    ),
  )('stays unchanged by Prettier with $scenario in $load mode', async ({ ending, load }) => {
    const project = createProject();
    projects.push(project);
    const body = `Example body.${ending}`;
    writeCatalog(project.projectPath, {
      packs: {
        demo: {
          skills: { example: { instructions: body } },
          agents: { example: { instructions: body } },
          guidelines: { example: { body } },
        },
      },
    });
    writeConfig(project.projectPath, {
      tools: [...TOOL_IDS],
      sources: { dev: { type: 'local', path: './catalog' } },
      packs: {
        dev: {
          demo: {
            skills: ['example'],
            agents: ['example'],
            guidelines: {
              example: load === 'always' ? { load } : { load, glob: ['src/index.ts'] },
            },
          },
        },
      },
    });
    new SyncCommand().execute(project.projectPath);

    const files = [
      ...['.claude', '.codex', '.cursor', '.github', '.opencode'].map(
        (dir) => `${dir}/skills/bolt-dev-demo-example/SKILL.md`,
      ),
      '.claude/agents/bolt-dev-demo-example.md',
      '.cursor/agents/bolt-dev-demo-example.md',
      '.github/agents/bolt-dev-demo-example.agent.md',
      '.opencode/agents/bolt-dev-demo-example.md',
      'AGENTS.md',
      ...(load === 'conditional'
        ? [
            '.claude/rules/bolt-dev-demo-example.md',
            '.cursor/rules/bolt-dev-demo-example.mdc',
            '.github/instructions/bolt-dev-demo-example.instructions.md',
          ]
        : ['CLAUDE.md', '.github/copilot-instructions.md']),
    ];
    for (const file of files) {
      const installed = project.read(file);
      expect(installed, file).toMatch(/[^\r\n]\n$/);
      const formatted = await format(installed, { parser: 'markdown' });
      expect(formatted, file).toBe(installed);
      project.write(file, formatted);
    }
    expect(new CheckCommand().execute(project.projectPath).drifted).toBe(false);
    const { toolSyncResults } = new SyncCommand().execute(project.projectPath);
    expect(toolSyncResults.every(({ changes }) => changes.length === 0)).toBe(true);
  });
});
