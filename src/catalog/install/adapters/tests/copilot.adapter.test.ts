import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';

import { CopilotAdapter } from '#catalog/install/adapters/copilot.adapter.js';
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

describe('CopilotAdapter.renderGuideline', () => {
  const adapter = new CopilotAdapter();

  it('maps an always guideline to applyTo ** as an .instructions.md file (U-COPILOT-1)', () => {
    const rendered = adapter.renderGuideline('src', 'pack', makeGuideline(), { load: 'always' });

    if (rendered.kind !== 'rule-file') {
      throw new Error('expected a rule-file guideline');
    }
    expect(rendered.filePath).toBe(
      '.github/instructions/bolt-src-pack-commit-rules.instructions.md',
    );

    const frontmatter = parseFrontmatter(rendered.content);
    expect(frontmatter.applyTo).toBe('**');
    expect(frontmatter.description).toBe('Commit conventions');
    expect(rendered.content.endsWith('Write good commits.\n')).toBe(true);
  });

  it('serializes conditional globs as a comma-joined applyTo string without spaces (U-COPILOT-2)', () => {
    const rendered = adapter.renderGuideline('src', 'pack', makeGuideline(), {
      load: 'conditional',
      glob: ['src/**/*.tsx', 'src/**/*.ts'],
    });

    if (rendered.kind !== 'rule-file') {
      throw new Error('expected a rule-file guideline');
    }

    const frontmatter = parseFrontmatter(rendered.content);
    expect(typeof frontmatter.applyTo).toBe('string');
    expect(frontmatter.applyTo).toBe('src/**/*.tsx,src/**/*.ts');
  });
});

describe('CopilotAdapter.renderSkill', () => {
  const adapter = new CopilotAdapter();

  it('installs under .github/skills with a folder-matching name and only copilot vendor config (U-COPILOT-3)', () => {
    const rendered = adapter.renderSkill(
      'src',
      'pack',
      makeSkill({
        toolConfig: {
          copilot: { 'disable-model-invocation': true },
          claude: { model: 'opus' },
        },
      }),
    );

    expect(rendered.dir).toBe('.github/skills/bolt-src-pack-create-commit');
    expect(rendered.entryFileName).toBe('SKILL.md');

    const frontmatter = parseFrontmatter(rendered.entryContent);
    expect(frontmatter.name).toBe('bolt-src-pack-create-commit');
    expect(frontmatter.description).toBe('Creates commits');
    expect(frontmatter['disable-model-invocation']).toBe(true);
    expect(frontmatter.model).toBeUndefined();
  });
});

describe('CopilotAdapter.renderAgent', () => {
  const adapter = new CopilotAdapter();

  it('installs a single .agent.md under .github/agents with only copilot vendor config (U-COPILOT-4)', () => {
    const rendered = adapter.renderAgent(
      'src',
      'pack',
      makeAgent({
        toolConfig: {
          copilot: { model: 'gpt-5.5', tools: ['search'] },
          codex: { sandbox_mode: 'read-only' },
        },
      }),
    );

    expect(rendered.filePath).toBe('.github/agents/bolt-src-pack-reviewer.agent.md');

    const frontmatter = parseFrontmatter(rendered.content);
    expect(frontmatter.name).toBe('bolt-src-pack-reviewer');
    expect(frontmatter.model).toBe('gpt-5.5');
    expect(frontmatter.tools).toEqual(['search']);
    expect(frontmatter.sandbox_mode).toBeUndefined();
  });
});
