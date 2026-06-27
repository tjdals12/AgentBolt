import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';

import { CursorAdapter } from '#catalog/install/adapters/cursor.adapter.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'create-commit',
    description: 'Creates commits',
    instructions: 'Do the thing.',
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
    ...overrides,
  };
}

function makeGuideline(overrides: Partial<Guideline> = {}): Guideline {
  return {
    name: 'commit-rules',
    description: 'Commit conventions',
    recommended: { load: 'always' },
    body: 'Write good commits.',
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

describe('CursorAdapter.renderGuideline', () => {
  const adapter = new CursorAdapter();

  it('maps an always guideline to alwaysApply true without globs (U-CURSOR-1)', () => {
    const rendered = adapter.renderGuideline('src', 'pack', makeGuideline(), { load: 'always' });

    if (rendered.kind !== 'rule-file') {
      throw new Error('expected a rule-file guideline');
    }
    expect(rendered.filePath).toBe('.cursor/rules/bolt-src-pack-commit-rules.mdc');

    const frontmatter = parseFrontmatter(rendered.content);
    expect(frontmatter.alwaysApply).toBe(true);
    expect(frontmatter.globs).toBeUndefined();
    expect(frontmatter.description).toBe('Commit conventions');
    expect(rendered.content.endsWith('Write good commits.\n')).toBe(true);
  });

  it('serializes conditional globs unquoted and comma-joined without spaces (U-CURSOR-2)', () => {
    const rendered = adapter.renderGuideline('src', 'pack', makeGuideline(), {
      load: 'conditional',
      glob: ['**/*.ts', '**/*.tsx'],
    });

    if (rendered.kind !== 'rule-file') {
      throw new Error('expected a rule-file guideline');
    }

    // Cursor reads a quoted value as a single literal pattern, so globs must be
    // raw, comma-separated, and space-free — not wrapped in quotes by YAML.
    expect(rendered.content).toContain('globs: **/*.ts,**/*.tsx');
    expect(rendered.content).not.toContain('globs: "');
    expect(rendered.content).toContain('alwaysApply: false');
  });
});

describe('CursorAdapter.renderSkill', () => {
  const adapter = new CursorAdapter();

  it('installs under .cursor/skills with a folder-matching name and only cursor vendor config (U-CURSOR-3)', () => {
    const rendered = adapter.renderSkill(
      'src',
      'pack',
      makeSkill({
        toolConfig: {
          cursor: { 'disable-model-invocation': true },
          claude: { model: 'opus' },
        },
      }),
    );

    expect(rendered.dir).toBe('.cursor/skills/bolt-src-pack-create-commit');
    expect(rendered.entryFileName).toBe('SKILL.md');

    const frontmatter = parseFrontmatter(rendered.entryContent);
    expect(frontmatter.name).toBe('bolt-src-pack-create-commit');
    expect(frontmatter.description).toBe('Creates commits');
    expect(frontmatter['disable-model-invocation']).toBe(true);
    expect(frontmatter.model).toBeUndefined();
  });
});

describe('CursorAdapter.renderAgent', () => {
  const adapter = new CursorAdapter();

  it('installs a single .md under .cursor/agents with only cursor vendor config (U-CURSOR-4)', () => {
    const rendered = adapter.renderAgent(
      'src',
      'pack',
      makeAgent({
        toolConfig: {
          cursor: { model: 'composer-2', readonly: true },
          codex: { sandbox_mode: 'read-only' },
        },
      }),
    );

    expect(rendered.filePath).toBe('.cursor/agents/bolt-src-pack-reviewer.md');

    const frontmatter = parseFrontmatter(rendered.content);
    expect(frontmatter.name).toBe('bolt-src-pack-reviewer');
    expect(frontmatter.model).toBe('composer-2');
    expect(frontmatter.readonly).toBe(true);
    expect(frontmatter.sandbox_mode).toBeUndefined();
  });
});
