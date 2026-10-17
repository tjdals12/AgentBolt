import { describe, expect, it } from 'vitest';

import { getAdapters } from '#catalog/install/adapters/registry.js';
import { DEFAULT_GUIDELINE_USAGE } from '#catalog/install/reference.js';
import { TOOL_IDS } from '#catalog/tool/model.js';

describe.each(getAdapters([...TOOL_IDS]))('$id reference usage', (adapter) => {
  it.each([
    {
      scenario: 'project overrides catalog',
      catalogUsage: 'Catalog instructions.',
      projectUsage: 'Project instructions.',
      expectedUsage: 'Project instructions.',
      expectedText: 'Project instructions.',
    },
    {
      scenario: 'project supplies missing catalog usage',
      catalogUsage: undefined,
      projectUsage: 'Project instructions.',
      expectedUsage: 'Project instructions.',
      expectedText: 'Project instructions.',
    },
    {
      scenario: 'catalog applies without a project override',
      catalogUsage: 'Catalog instructions.',
      projectUsage: undefined,
      expectedUsage: 'Catalog instructions.',
      expectedText: 'Catalog instructions.',
    },
    {
      scenario: 'fallback applies when both are missing',
      catalogUsage: undefined,
      projectUsage: undefined,
      expectedUsage: undefined,
      expectedText: DEFAULT_GUIDELINE_USAGE,
    },
  ])('$scenario', ({ catalogUsage, projectUsage, expectedUsage, expectedText }) => {
    const rendered = adapter.renderGuideline(
      'team',
      'backend',
      {
        name: 'rules',
        description: 'Backend rules',
        recommended: { load: 'always' },
        usage: catalogUsage,
        body: 'Guideline body.',
        bodyPath: '/catalog/packs/backend/guidelines/rules/content.md',
      },
      { load: 'reference', path: 'docs/guidelines', usage: projectUsage },
    );

    expect(rendered.usage).toBe(expectedUsage);
    if (rendered.kind !== 'reference-file') {
      throw new Error('expected a reference-file guideline');
    }
    const linkPrefix = adapter.id === 'copilot' ? '../' : '';
    expect(rendered.reference).toBe(
      `- [rules](${linkPrefix}docs/guidelines/bolt-team-backend-rules.md): ${expectedText}`,
    );
    expect(rendered.content).toBe('Guideline body.');
  });
});
