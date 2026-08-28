import { describe, it, expect } from 'vitest';

import { ListPacksCommand } from '#catalog/commands/list-packs.js';
import { ListItemsCommand } from '#catalog/commands/list-items.js';
import { ShowItemCommand } from '#catalog/commands/show-item.js';
import { CheckCommand } from '#catalog/commands/check.js';
import { SyncCommand } from '#catalog/commands/sync.js';
import { AddPackCommand } from '#catalog/commands/add-pack.js';
import { RemovePackCommand } from '#catalog/commands/remove-pack.js';
import { AddItemCommand } from '#catalog/commands/add-item.js';
import { RemoveItemCommand } from '#catalog/commands/remove-item.js';
import { InitCommand } from '#catalog/commands/init.js';
import { SkillInstallCommand } from '#catalog/commands/skill-install.js';
import { ValidateCatalogCommand } from '#catalog/commands/catalog/validate-catalog.js';
import { InitCatalogCommand } from '#catalog/commands/catalog/init-catalog.js';
import { NewPackCommand } from '#catalog/commands/catalog/new-pack.js';
import { NewSkillCommand } from '#catalog/commands/catalog/new/new-skill.js';

const COUNTS = { skills: 1, agents: 0, guidelines: 0 };

describe('CheckCommand.toJson', () => {
  it('maps internal statuses to check vocabulary and keeps source', () => {
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

    expect(json).toEqual({
      tools: [
        {
          tool: 'claude',
          counts: COUNTS,
          changes: [
            { source: 'common', label: 'pack/a', status: 'missing' },
            { source: 'common', label: 'pack/b', status: 'drifted' },
            { source: null, label: 'pack/c', status: 'orphaned' },
          ],
        },
      ],
      drifted: true,
    });
  });
});

describe('SyncCommand.toJson', () => {
  it('wraps the result in tools and keeps the original status vocabulary', () => {
    const changes = [{ source: 'common', label: 'pack/a', status: 'installed' as const }];
    const json = new SyncCommand().toJson([{ tool: 'claude', counts: COUNTS, changes }]);

    expect(json).toEqual({ tools: [{ tool: 'claude', counts: COUNTS, changes }] });
  });
});

describe('ShowItemCommand.toJson', () => {
  const command = new ShowItemCommand({ source: 'common', pack: 'git', item: 'x' });

  it('serializes a skill with absolute asset paths and no sourceDir', () => {
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

    expect(json.source).toBe('common');
    expect(json.pack).toBe('git');
    expect(json.items[0]).not.toHaveProperty('sourceDir');
    expect(json.items[0]).toMatchObject({
      type: 'skill',
      instructionsPath: '/cat/packs/git/skills/x/instructions.md',
      assets: [
        { name: 'a.md', path: '/cat/packs/git/skills/x/a.md' },
        { name: 'refs/b.md', path: '/cat/packs/git/skills/x/refs/b.md' },
      ],
    });
  });

  it('serializes agent and guideline with singular types and body paths', () => {
    const json = command.toJson({
      sourceAlias: 'common',
      packName: 'git',
      items: [
        {
          type: 'agents',
          name: 'a',
          description: 'd',
          toolConfig: undefined,
          instructions: 'i',
          instructionsPath: '/p/agents/a/instructions.md',
        },
        {
          type: 'guidelines',
          name: 'g',
          description: 'd',
          recommended: { load: 'always' },
          body: 'b',
          bodyPath: '/p/guidelines/g/body.md',
        },
      ],
    });

    expect(json.items[0]).toMatchObject({
      type: 'agent',
      instructionsPath: '/p/agents/a/instructions.md',
    });
    expect(json.items[1]).toMatchObject({
      type: 'guideline',
      bodyPath: '/p/guidelines/g/body.md',
      recommended: { load: 'always' },
    });
  });
});

describe('ListPacksCommand.toJson', () => {
  it('renames sourceCatalogs to sources', () => {
    const packs = [{ name: 'p', description: 'd', counts: COUNTS }];
    const json = new ListPacksCommand({}).toJson({
      sourceCatalogs: [{ alias: 'common', type: 'local', packs }],
      failures: ['boom'],
    });

    expect(json).toEqual({
      sources: [{ alias: 'common', type: 'local', packs }],
      failures: ['boom'],
    });
  });
});

describe('ListItemsCommand.toJson', () => {
  it('renames sourceCatalogs to sources', () => {
    const packs = [
      { name: 'p', description: 'd', items: { skills: [], agents: [], guidelines: [] } },
    ];
    const json = new ListItemsCommand({}).toJson({
      sourceCatalogs: [{ alias: 'common', type: 'git', packs }],
      failures: [],
    });

    expect(json).toEqual({ sources: [{ alias: 'common', type: 'git', packs }], failures: [] });
  });
});

describe('AddPackCommand.toJson', () => {
  it('renames source fields and keeps failures', () => {
    const added = [{ name: 'p', skills: ['s'], agents: [], guidelines: {} }];
    const json = new AddPackCommand({ json: true }).toJson({
      results: [{ sourceAlias: 'common', addedPacks: added, skippedPackNames: ['q'] }],
      failures: ['boom'],
    });

    expect(json).toEqual({
      results: [{ source: 'common', added, skipped: ['q'] }],
      failures: ['boom'],
    });
  });
});

describe('RemovePackCommand.toJson', () => {
  it('wraps the bare array in results with empty failures', () => {
    const removed = [{ name: 'p', skills: [], agents: [], guidelines: [] }];
    const json = new RemovePackCommand({ json: true }).toJson([
      { sourceAlias: 'common', removedPacks: removed, skippedPackNames: [] },
    ]);

    expect(json).toEqual({
      results: [{ source: 'common', removed, skipped: [] }],
      failures: [],
    });
  });
});

describe('AddItemCommand.toJson / RemoveItemCommand.toJson', () => {
  const items = { skills: ['a'], agents: [], guidelines: [] };
  const none = { skills: [], agents: [], guidelines: [] };

  it('renames pack fields on add', () => {
    const json = new AddItemCommand({ json: true }).toJson({
      results: [
        {
          sourceAlias: 'c',
          packs: [{ packName: 'p', packCreated: true, addedItems: items, skippedItems: none }],
        },
      ],
      failures: [],
    });

    expect(json.results[0]?.packs[0]).toEqual({
      name: 'p',
      created: true,
      added: items,
      skipped: none,
    });
  });

  it('renames pack fields on remove', () => {
    const json = new RemoveItemCommand({ json: true }).toJson({
      results: [
        {
          sourceAlias: 'c',
          packs: [{ packName: 'p', packPruned: false, removedItems: items, skippedItems: none }],
        },
      ],
      failures: [],
    });

    expect(json.results[0]?.packs[0]).toEqual({
      name: 'p',
      pruned: false,
      removed: items,
      skipped: none,
    });
  });
});

describe('InitCommand.toJson', () => {
  it('renames orphanedSourceAliases to orphanedSources', () => {
    const sources = { dev: { type: 'local' as const, path: './catalog' } };
    const json = new InitCommand({ tools: 'claude', source: [], force: false, json: true }).toJson({
      configPath: '/p/.agent-bolt/catalog-config.yml',
      tools: ['claude'],
      sources,
      orphanedSourceAliases: ['old'],
    });

    expect(json).toEqual({
      configPath: '/p/.agent-bolt/catalog-config.yml',
      tools: ['claude'],
      sources,
      orphanedSources: ['old'],
    });
  });
});

describe('ValidateCatalogCommand.toJson', () => {
  it('renames counts and issues and keeps invalid', () => {
    const issues = [{ severity: 'error' as const, location: 'packs/p', message: 'm' }];
    const json = new ValidateCatalogCommand().toJson({
      validateCatalogResult: {
        catalogDir: '/cat',
        catalogCounts: { packs: 1, items: COUNTS },
        validationIssues: issues,
      },
      invalid: true,
    });

    expect(json).toEqual({
      catalogDir: '/cat',
      counts: { packs: 1, items: COUNTS },
      issues,
      invalid: true,
    });
  });
});

describe('catalog authoring toJson', () => {
  it('passes init-catalog and new-pack results through', () => {
    const result = {
      catalogDir: '/cat',
      name: 'n',
      description: 'd',
      createdPaths: ['catalog.json'],
    };
    expect(new InitCatalogCommand({}).toJson(result)).toEqual(result);
    expect(new NewPackCommand({ name: 'n' }).toJson(result)).toEqual(result);
  });

  it('renames packName to pack for new items', () => {
    const json = new NewSkillCommand({ pack: 'p', name: 'n' }).toJson({
      catalogDir: '/cat',
      packName: 'p',
      item: { name: 'n', description: 'd' },
      createdPaths: ['packs/p/skills/n/skill.json'],
    });

    expect(json).toEqual({
      catalogDir: '/cat',
      pack: 'p',
      item: { name: 'n', description: 'd' },
      createdPaths: ['packs/p/skills/n/skill.json'],
    });
  });
});

describe('SkillInstallCommand.toJson', () => {
  it('returns the result as-is', () => {
    const result = {
      skill: 'agent-bolt',
      version: '1.0.0',
      tools: [
        {
          tool: 'claude' as const,
          path: '.claude/skills/agent-bolt',
          status: 'installed' as const,
        },
      ],
    };
    expect(new SkillInstallCommand().toJson(result)).toEqual(result);
  });
});
