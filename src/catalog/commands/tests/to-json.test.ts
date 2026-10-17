import { describe, it, expect } from 'vitest';

import { ShowItemCommand } from '#catalog/commands/show-item.js';
import { CheckCommand } from '#catalog/commands/check.js';

const COUNTS = { skills: 1, agents: 0, guidelines: 0 };

describe('CheckCommand.toJson', () => {
  it('maps installation statuses to check statuses', () => {
    const json = new CheckCommand().toJson({
      checkResult: [
        {
          tool: 'claude',
          counts: COUNTS,
          changes: [
            { source: 'common', label: 'pack/a', status: 'installed' },
            { source: 'common', label: 'pack/b', status: 'updated' },
            { source: null, label: 'pack/c', status: 'removed' },
          ],
        },
      ],
      drifted: true,
    });

    const changes = json.tools.flatMap((toolResult) => toolResult.changes);
    expect(changes).toContainEqual(expect.objectContaining({ label: 'pack/a', status: 'missing' }));
    expect(changes).toContainEqual(expect.objectContaining({ label: 'pack/b', status: 'drifted' }));
    expect(changes).toContainEqual(
      expect.objectContaining({ label: 'pack/c', status: 'orphaned' }),
    );
  });
});

describe('ShowItemCommand.toJson', () => {
  it('resolves skill asset paths from the source directory', () => {
    const command = new ShowItemCommand({ source: 'common', pack: 'git', item: 'x' });
    const json = command.toJson({
      sourceAlias: 'common',
      packName: 'git',
      items: [
        {
          type: 'skills',
          name: 'x',
          description: 'd',
          toolConfig: undefined,
          instructions: 'body',
          instructionsPath: '/cat/packs/git/skills/x/instructions.md',
          sourceDir: '/cat/packs/git/skills/x',
          assets: ['a.md', 'refs/b.md'],
        },
      ],
    });

    const skill = json.items.find((item) => item.name === 'x');
    expect(skill?.assets).toEqual(
      expect.arrayContaining([
        { name: 'a.md', path: '/cat/packs/git/skills/x/a.md' },
        { name: 'refs/b.md', path: '/cat/packs/git/skills/x/refs/b.md' },
      ]),
    );
  });
});
