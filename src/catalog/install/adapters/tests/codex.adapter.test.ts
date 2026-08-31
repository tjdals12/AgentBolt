import { describe, it, expect } from 'vitest';
import { parse } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

import { CodexAdapter } from '#catalog/install/adapters/codex.adapter.js';
import type { Agent, Skill } from '#catalog/content/item/model.js';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    name: 'reviewer',
    description: 'Reviews code',
    instructions: 'Be helpful.',
    instructionsPath: '/catalog/packs/pack/agents/reviewer/instructions.md',
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'create-commit',
    description: 'Creates commits',
    instructions: 'Do the thing.',
    instructionsPath: '/catalog/packs/pack/skills/create-commit/instructions.md',
    sourceDir: '/catalog/packs/pack/skills/create-commit',
    assets: [],
    ...overrides,
  };
}

function renderToToml(agent: Agent): Record<string, unknown> {
  const adapter = new CodexAdapter();
  const { content } = adapter.renderAgent('src', 'pack', agent);
  return parse(content);
}

describe('CodexAdapter.renderAgent TOML serialization', () => {
  it('survives triple-quote sequences in instructions (U-CODEX-1)', () => {
    const instructions = 'Wrap in """triple quotes""" and continue.';
    const parsed = renderToToml(makeAgent({ instructions }));

    expect(typeof parsed.developer_instructions).toBe('string');
    expect((parsed.developer_instructions as string).trimEnd()).toBe(instructions);
  });

  it('survives backslashes including a trailing one (U-CODEX-2)', () => {
    const instructions = 'Windows path C:\\temp and a trailing backslash \\';
    const parsed = renderToToml(makeAgent({ instructions }));

    expect((parsed.developer_instructions as string).trimEnd()).toBe(instructions);
  });

  it('merges only the codex vendor config and core fields (U-CODEX-3)', () => {
    const parsed = renderToToml(
      makeAgent({
        toolConfig: {
          codex: {
            name: 'custom-name',
            description: 'Custom description',
            sandbox_mode: 'read-only',
          },
          claude: { model: 'opus' },
        },
      }),
    );

    expect(parsed.name).toBe('bolt-src-pack-reviewer');
    expect(parsed.description).toBe('Reviews code');
    expect(parsed.sandbox_mode).toBe('read-only');
    expect(parsed.model).toBeUndefined();
  });
});

describe('CodexAdapter.renderSkill', () => {
  it('keeps required metadata ahead of colliding Codex config values (U-CODEX-4)', () => {
    const adapter = new CodexAdapter();
    const rendered = adapter.renderSkill(
      'src',
      'pack',
      makeSkill({
        toolConfig: {
          codex: {
            name: 'custom-name',
            description: 'Custom description',
            sandbox_mode: 'read-only',
          },
        },
      }),
    );

    const block = rendered.entryContent.match(/^---\n([\s\S]*?)\n---/)?.[1];
    if (block === undefined) {
      throw new Error('no frontmatter found');
    }
    const frontmatter = parseYaml(block) as Record<string, unknown>;

    expect(frontmatter.name).toBe('bolt-src-pack-create-commit');
    expect(frontmatter.description).toBe('Creates commits');
    expect(frontmatter.sandbox_mode).toBe('read-only');
  });
});
