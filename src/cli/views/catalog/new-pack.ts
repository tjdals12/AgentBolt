import chalk from 'chalk';

import path from 'node:path';

import type { NewPackResult } from '#catalog/commands/catalog/new-pack.js';

import { Banner } from '../shared/banner.js';

export function renderNewPackResult(result: NewPackResult, projectPath: string): void {
  const { catalogDir, name, description, createdPaths } = result;

  Banner.catalog.newPack(name);
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
  console.log(chalk.dim('Next, add items to the pack:'));
  console.log(`  ${chalk.bold(`agent-bolt catalog new-skill <name> --pack=${name}`)}`);
  console.log(`  ${chalk.bold(`agent-bolt catalog new-agent <name> --pack=${name}`)}`);
  console.log(`  ${chalk.bold(`agent-bolt catalog new-guideline <name> --pack=${name}`)}`);
}
