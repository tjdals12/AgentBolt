import path from 'node:path';

import type { NewItemResult } from '#catalog/commands/catalog/new/new-item.js';

import { Banner } from '../../shared/banner.js';
import chalk from 'chalk';

export function renderNewGuidelineResult(result: NewItemResult, projectPath: string): void {
  const { catalogDir, packName, item, createdPaths } = result;
  const { name, description } = item;

  Banner.catalog.newGuideline(name);
  console.log('');

  const relative = path.relative(projectPath, catalogDir);
  const location = relative === '' ? '.' : relative.startsWith('..') ? catalogDir : relative;
  console.log(`${chalk.dim('name:'.padEnd(12))} ${name}`);
  console.log(`${chalk.dim('pack:'.padEnd(12))} ${packName}`);
  console.log(`${chalk.dim('description:'.padEnd(12))} ${description}`);
  console.log(`${chalk.dim('location:'.padEnd(12))} ${location}`);

  console.log('');
  for (const createdPath of createdPaths) {
    console.log(`  ${chalk.green('+')} ${createdPath}`);
  }

  console.log('');
  console.log(chalk.dim('Required content — edit the generated files:'));
  console.log(
    `  ${chalk.bold('usage')}  ${chalk.dim('in guideline.json, describe when to read this guideline')}`,
  );
  console.log(`  ${chalk.bold('body')}  ${chalk.dim('write the guideline in content.md')}`);

  console.log('');
  console.log(chalk.dim('Optional settings — edit guideline.json:'));
  console.log(
    `  ${chalk.bold('recommended')}  ${chalk.dim('reference a separate file, e.g. { "load": "reference", "path": "docs/guidelines" }')}`,
  );
  console.log(chalk.dim('  path is an installation directory relative to the project root'));

  console.log('');
  console.log(chalk.dim('Next, fill in the guideline, then validate:'));
  console.log(`  ${chalk.bold('agent-bolt catalog validate')}`);
}
