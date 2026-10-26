import { afterEach, describe, expect, it } from 'vitest';

import { ValidateCatalogCommand } from '#catalog/commands/catalog/validate-catalog.js';
import type { GuidelineRecommendation } from '#catalog/content/item/schema.js';
import { DEFAULT_GUIDELINE_USAGE } from '#catalog/install/reference.js';

import { createProject, writeCatalog, type TempProject } from './project-fixture.js';

const projects: TempProject[] = [];
const manifestPath = '.agent-bolt/catalog/packs/demo/guidelines/rules/guideline.json';

afterEach(() => {
  while (projects.length > 0) {
    projects.pop()?.cleanup();
  }
});

describe('catalog validate (integration)', () => {
  it.each<{ recommended: GuidelineRecommendation; invalid: boolean }>([
    { recommended: { load: 'always' }, invalid: false },
    { recommended: { load: 'conditional', glob: ['src/**/*.ts'] }, invalid: false },
    { recommended: { load: 'reference', path: 'docs/guidelines' }, invalid: true },
  ])('validates missing usage for recommended $recommended.load', ({ recommended, invalid }) => {
    const project = createProject();
    projects.push(project);
    const catalogDir = writeCatalog(project.projectPath, {
      packs: { demo: { guidelines: { rules: { recommended } } } },
    });
    const manifestContent = JSON.stringify({
      name: 'rules',
      description: 'rules guideline',
      body: './content.md',
      recommended,
    });
    project.write(manifestPath, manifestContent);

    const command = new ValidateCatalogCommand();
    const result = command.execute(catalogDir);

    expect(result.invalid).toBe(invalid);
    expect(result.validateCatalogResult.validationIssues).toEqual(
      invalid
        ? [
            {
              severity: 'error',
              location: 'packs/demo/guidelines/rules/guideline.json',
              message:
                "Missing required field 'usage' for recommended.load 'reference'.\nDescribe when an agent should read this guideline.",
            },
          ]
        : [],
    );
    expect(command.toJson(result)).toMatchObject({
      invalid,
      issues: result.validateCatalogResult.validationIssues,
    });
    expect(project.read(manifestPath)).toBe(manifestContent);
  });

  it('accepts explicitly authored usage even when it matches the compatibility default', () => {
    const project = createProject();
    projects.push(project);
    const catalogDir = writeCatalog(project.projectPath, {
      packs: {
        demo: {
          guidelines: {
            rules: {
              usage: DEFAULT_GUIDELINE_USAGE,
              recommended: { load: 'reference', path: 'docs/guidelines' },
            },
          },
        },
      },
    });

    const result = new ValidateCatalogCommand().execute(catalogDir);

    expect(result.invalid).toBe(false);
    expect(result.validateCatalogResult.validationIssues).toEqual([]);
  });

  it('keeps the schema error for explicitly empty usage without adding a missing-field error', () => {
    const project = createProject();
    projects.push(project);
    const catalogDir = writeCatalog(project.projectPath, {
      packs: { demo: { guidelines: { rules: { usage: '' } } } },
    });

    const result = new ValidateCatalogCommand().execute(catalogDir);

    expect(result.invalid).toBe(true);
    const issues = result.validateCatalogResult.validationIssues;
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.message).toMatch(/invalid format:[\s\S]*usage/);
  });
});
