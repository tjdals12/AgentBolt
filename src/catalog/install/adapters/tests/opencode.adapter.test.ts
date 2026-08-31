import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';

import { OpenCodeAdapter } from '#catalog/install/adapters/opencode.adapter.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

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

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    name: 'reviewer',
    description: 'Reviews code',
    instructions: 'Be helpful.',
    instructionsPath: '/catalog/packs/pack/agents/reviewer/instructions.md',
    ...overrides,
  };
}

function makeGuideline(overrides: Partial<Guideline> = {}): Guideline {
  return {
    name: 'commit-rules',
    description: 'Commit conventions',
    recommended: { load: 'always' },
    body: 'Write good commits.',
    bodyPath: '/catalog/packs/pack/guidelines/commit-rules/body.md',
    ...overrides,
  };
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const block = content.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (block === undefined) {
    throw new Error('no frontmatter found');
  }
  return parse(block) as Record<string, unknown>;
}

describe('OpenCodeAdapter.renderSkill', () => {
  const adapter = new OpenCodeAdapter();

  it('installs under .opencode/skills with a folder-matching name and only opencode vendor config (U-OPENCODE-1)', () => {
    const rendered = adapter.renderSkill(
      'src',
      'pack',
      makeSkill({
        toolConfig: {
          opencode: { license: 'MIT' },
          claude: { model: 'opus' },
        },
      }),
    );

    expect(rendered.dir).toBe('.opencode/skills/bolt-src-pack-create-commit');
    expect(rendered.entryFileName).toBe('SKILL.md');

    const frontmatter = parseFrontmatter(rendered.entryContent);
    expect(frontmatter.name).toBe('bolt-src-pack-create-commit');
    expect(frontmatter.description).toBe('Creates commits');
    expect(frontmatter.license).toBe('MIT');
    expect(frontmatter.model).toBeUndefined();
  });
});

describe('OpenCodeAdapter.renderAgent', () => {
  const adapter = new OpenCodeAdapter();

  it('installs a single .md under .opencode/agents defaulting to mode subagent without a name field (U-OPENCODE-2)', () => {
    const rendered = adapter.renderAgent('src', 'pack', makeAgent());

    expect(rendered.filePath).toBe('.opencode/agents/bolt-src-pack-reviewer.md');

    const frontmatter = parseFrontmatter(rendered.content);
    expect(frontmatter.mode).toBe('subagent');
    expect(frontmatter.description).toBe('Reviews code');
    expect(frontmatter.name).toBeUndefined();
    expect(rendered.content.endsWith('Be helpful.\n')).toBe(true);
  });

  it('merges only the opencode vendor config, preserves the catalog description, and lets it override the default mode (U-OPENCODE-3)', () => {
    const rendered = adapter.renderAgent(
      'src',
      'pack',
      makeAgent({
        toolConfig: {
          opencode: {
            description: 'Custom description',
            mode: 'primary',
            model: 'anthropic/claude',
            temperature: 0.2,
          },
          codex: { sandbox_mode: 'read-only' },
        },
      }),
    );

    const frontmatter = parseFrontmatter(rendered.content);
    expect(frontmatter.description).toBe('Reviews code');
    expect(frontmatter.mode).toBe('primary');
    expect(frontmatter.model).toBe('anthropic/claude');
    expect(frontmatter.temperature).toBe(0.2);
    expect(frontmatter.sandbox_mode).toBeUndefined();
  });
});

describe('OpenCodeAdapter.renderGuideline', () => {
  const adapter = new OpenCodeAdapter();

  it('renders an always guideline as a block fragment with a source tag (U-OPENCODE-4)', () => {
    const rendered = adapter.renderGuideline('src', 'pack', makeGuideline(), { load: 'always' });

    if (rendered.kind !== 'block-fragment') {
      throw new Error('expected a block-fragment guideline');
    }
    expect(rendered.fragment).toContain(
      '<!-- bolt: src/pack/commit-rules - Commit conventions -->',
    );
    expect(rendered.fragment).toContain('Write good commits.');
    expect(rendered.fragment).not.toContain('applies only when working with files');
  });

  it('notes the matching globs for a conditional guideline (U-OPENCODE-5)', () => {
    const rendered = adapter.renderGuideline('src', 'pack', makeGuideline(), {
      load: 'conditional',
      glob: ['**/*.ts', '**/*.tsx'],
    });

    if (rendered.kind !== 'block-fragment') {
      throw new Error('expected a block-fragment guideline');
    }
    expect(rendered.fragment).toContain(
      'applies only when working with files matching `**/*.ts`, `**/*.tsx`',
    );
  });
});
