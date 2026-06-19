import path from 'node:path';

import chalk from 'chalk';

import type { InitCatalogResult } from '#catalog/commands/catalog/init-catalog.js';

import { Banner } from '../shared/banner.js';

export function renderInitCatalogResult(result: InitCatalogResult, projectPath: string): void {
  const { catalogDir, name, description, createdPaths } = result;

  Banner.catalog.init();
  console.log('');

  const relative = path.relative(projectPath, catalogDir);
  const location = relative === '' ? '.' : relative.startsWith('..') ? catalogDir : relative;
  console.log(`${chalk.dim('name:'.padEnd(12))} ${name}`);
  console.log(`${chalk.dim('description:'.padEnd(12))} ${description}`);
  console.log(`${chalk.dim('location:'.padEnd(12))} ${location}`);

  console.log('');
  for (const createdPath of createdPaths) {
    console.log(`  ${chalk.green('+')} ${createdPath}`);
  }

  console.log('');
  console.log(chalk.dim('Next, add a pack:'));
  console.log(`  ${chalk.bold('agent-bolt catalog new-pack <name>')}`);
}
