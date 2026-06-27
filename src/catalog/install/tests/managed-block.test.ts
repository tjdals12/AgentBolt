import { describe, it, expect } from 'vitest';

import {
  buildManagedBlock,
  buildManagedBlockContent,
  replaceManagedBlock,
} from '#catalog/install/managed-block/render.js';
import { groupManagedBlocksByFile } from '#catalog/install/managed-block/group.js';
import type { ToolPlan } from '#catalog/install/model.js';
import type { ToolId } from '#catalog/tool/model.js';

const START = '<!-- bolt:start -->';
const END = '<!-- bolt:end -->';

function countOccurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

function docWith(before: string, fragment: string, after: string): string {
  const block = buildManagedBlock(buildManagedBlockContent([fragment]));
  return `${before}${block}${after}`;
}

describe('replaceManagedBlock', () => {
  it('preserves user text above and below the block verbatim (U-MB-1)', () => {
    const before = '# AGENTS\n\nIntro written by a human.\n\n';
    const after = '\n\n## Footer kept by the human\n';
    const doc = docWith(before, 'old fragment', after);

    const result = replaceManagedBlock(doc, buildManagedBlockContent(['new fragment']));

    expect(result.startsWith(before)).toBe(true);
    expect(result.endsWith(after)).toBe(true);
    expect(result).toContain('new fragment');
    expect(result).not.toContain('old fragment');
  });

  it('throws when no markers are present (U-MB-2)', () => {
    expect(() => replaceManagedBlock('no markers here', 'x')).toThrow(/markers/i);
  });

  it('throws when markers are duplicated or unbalanced (U-MB-3)', () => {
    const doc = `${START}\na\n${END}\n${START}\nb\n${END}`;
    expect(() => replaceManagedBlock(doc, 'x')).toThrow(/unbalanced|duplicated/i);
  });

  it('throws when the end marker precedes the start marker (U-MB-4)', () => {
    const doc = `${END}\nbody\n${START}`;
    expect(() => replaceManagedBlock(doc, 'x')).toThrow(/before the start/i);
  });

  it('is idempotent across repeated replacement (U-MB-5)', () => {
    const doc = docWith('top\n', 'frag', '\nbottom');
    const content = buildManagedBlockContent(['frag-v2']);

    const once = replaceManagedBlock(doc, content);
    const twice = replaceManagedBlock(once, content);

    expect(twice).toBe(once);
    expect(countOccurrences(twice, START)).toBe(1);
    expect(countOccurrences(twice, END)).toBe(1);
  });
});

describe('buildManagedBlockContent', () => {
  it('returns an empty body for no fragments (U-MB-6a)', () => {
    expect(buildManagedBlockContent([])).toBe('');
  });

  it('joins fragments with blank lines and trims trailing whitespace (U-MB-6b)', () => {
    expect(buildManagedBlockContent(['a   ', 'b\n'])).toBe('\na\n\n\nb\n');
  });
});

describe('groupManagedBlocksByFile', () => {
  function plan(tool: ToolId, managedBlock?: { filePath: string; fragments: string[] }): ToolPlan {
    return {
      tool,
      renderedSkills: [],
      renderedAgents: [],
      renderedGuidelines: [],
      managedBlock,
    };
  }

  it('collapses tools sharing a file into one block, recording every contributor (U-MB-7)', () => {
    const plans = [
      plan('codex', { filePath: 'AGENTS.md', fragments: ['frag-a', 'frag-b'] }),
      plan('claude', { filePath: 'AGENTS.md', fragments: ['frag-a', 'frag-b'] }),
    ];

    const result = groupManagedBlocksByFile(plans);

    expect(result).toEqual([
      { filePath: 'AGENTS.md', fragments: ['frag-a', 'frag-b'], tools: ['codex', 'claude'] },
    ]);
  });

  it('keeps blocks for different files separate (U-MB-8)', () => {
    const plans = [
      plan('codex', { filePath: 'AGENTS.md', fragments: ['frag-a'] }),
      plan('claude', { filePath: 'CLAUDE.md', fragments: ['frag-b'] }),
    ];

    const result = groupManagedBlocksByFile(plans);

    expect(result.map((block) => block.filePath)).toEqual(['AGENTS.md', 'CLAUDE.md']);
  });

  it('skips tools that have no managed block (U-MB-9)', () => {
    const plans = [plan('codex'), plan('claude', { filePath: 'AGENTS.md', fragments: ['frag-a'] })];

    const result = groupManagedBlocksByFile(plans);

    expect(result).toEqual([{ filePath: 'AGENTS.md', fragments: ['frag-a'], tools: ['claude'] }]);
  });
});
