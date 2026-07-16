import chalk from 'chalk';

import type { AddPackResult, AddedPack } from '#catalog/commands/add-pack.js';
import { alignPackRows } from '#cli/format.js';

import { printSyncHint } from './shared/sync-hint.js';
import { Banner } from './shared/banner.js';

function printAddedPacks(packs: AddedPack[], indent: string): void {
  const rows = alignPackRows(
    packs.map((pack) => ({
      name: pack.name,
      counts: {
        skills: pack.skills.length,
        agents: pack.agents.length,
        guidelines: Object.keys(pack.guidelines).length,
      },
    })),
  );
  for (const row of rows) {
    console.log(`${indent}${chalk.green('+')} 📂 ${chalk.bold(row.paddedName)}  ${row.counts}`);
  }
}

export function renderAddPackResult(result: AddPackResult): void {
  const { results, failures } = result;
  const totalAdded = results.reduce((sum, source) => sum + source.addedPacks.length, 0);
  const multi = results.length > 1;

  if (results.length === 1) {
    const only = results[0]!;
    Banner.addPack(only.addedPacks.length, only.sourceAlias);
  } else {
    Banner.addPacks(totalAdded);
  }

  for (const source of results) {
    const { sourceAlias, addedPacks, skippedPackNames } = source;

    if (multi) {
      console.log('');
      console.log(`▸ ${chalk.bold(sourceAlias)}`);
      printAddedPacks(addedPacks, '  ');
    } else if (addedPacks.length > 0) {
      console.log('');
      printAddedPacks(addedPacks, '');
    }

    for (const skipped of skippedPackNames) {
      console.log(`  ${chalk.dim(`📂 ${skipped} — already in source '${sourceAlias}'`)}`);
    }
  }

  if (failures.length > 0) {
    console.log('');
    for (const failure of failures) {
      const [first, ...rest] = failure.split('\n');
      console.log(chalk.yellow(`⚠ ${first}`));
      for (const line of rest) {
        console.log(line);
      }
    }
  }

  if (totalAdded > 0) {
    printSyncHint();
  }
}
