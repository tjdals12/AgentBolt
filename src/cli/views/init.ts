import chalk from 'chalk';

import path from 'node:path';

import type { InitResult } from '#catalog/commands/init.js';

import { printSyncHint } from './shared/sync-hint.js';
import { Banner } from './shared/banner.js';
import { ConsoleOutput } from '#core/output.js';
import { getTool } from '#catalog/tool/catalog.js';

export function renderInitResult(result: InitResult, projectPath: string): void {
  const { configPath, tools, sources, orphanedSourceAliases } = result;

  Banner.init();
  console.log('');

  const fullConfigPath = path.relative(projectPath, configPath);
  const selectedTools = tools
    .map((id) => {
      const tool = getTool(id);
      return tool.displayName;
    })
    .join(', ');
  const sourceAliases = Object.entries(sources)
    .map(([alias, source]) => `${alias} (${source.type})`)
    .join(', ');

  console.log(`${chalk.dim('config:'.padEnd(8))} ${fullConfigPath}`);
  console.log(`${chalk.dim('tools:'.padEnd(8))} ${selectedTools}`);
  console.log(`${chalk.dim('sources:'.padEnd(8))} ${sourceAliases}`);

  if (orphanedSourceAliases.length > 0) {
    ConsoleOutput.warn(
      `Removed orphaned packs for source(s) no longer configured: ${orphanedSourceAliases.join(', ')}`,
    );
  }

  printSyncHint();
}
