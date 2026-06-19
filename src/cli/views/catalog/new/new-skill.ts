import path from 'node:path';

import type { NewItemResult } from '#catalog/commands/catalog/new/new-item.js';
import { listTools } from '#catalog/tool/catalog.js';

import { Banner } from '../../shared/banner.js';
import chalk from 'chalk';

export function renderNewSkillResult(result: NewItemResult, projectPath: string): void {
  const { catalogDir, packName, item, createdPaths } = result;
  const { name, description } = item;

  Banner.catalog.newSkill(name);
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
  console.log(chalk.dim('Optional settings — add to skill.json:'));
  const toolKeys = listTools()
    .map((tool) => `"${tool.id}": { … }`)
    .join(', ');
  console.log(
    `  ${chalk.bold('toolConfig'.padEnd(10))}  ${chalk.dim(`per-tool settings, e.g. { ${toolKeys} }`)}`,
  );
  console.log(
    `  ${chalk.bold('assets'.padEnd(10))}  ${chalk.dim('extra files to ship, e.g. ["references/guide.md"]')}`,
  );

  console.log('');
  console.log(chalk.dim('Next, fill in the skill, then validate:'));
  console.log(`  ${chalk.bold('agent-bolt catalog validate')}`);
}
