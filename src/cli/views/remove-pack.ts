import chalk from 'chalk';

import type { RemovePackResult, RemovedPack } from '#catalog/commands/remove-pack.js';
import { alignPackRows } from '#cli/format.js';

import { printSyncHint } from './shared/sync-hint.js';
import { Banner } from './shared/banner.js';

function printRemovedPacks(packs: RemovedPack[], indent: string): void {
  const rows = alignPackRows(
    packs.map((pack) => ({
      name: pack.name,
      counts: {
        skills: pack.skills.length,
        agents: pack.agents.length,
        guidelines: pack.guidelines.length,
      },
    })),
  );
  for (const row of rows) {
    console.log(`${indent}${chalk.red('-')} 📂 ${chalk.bold(row.paddedName)}  ${row.counts}`);
  }
}

export function renderRemovePackResult(results: RemovePackResult): void {
  const totalRemoved = results.reduce((sum, source) => sum + source.removedPacks.length, 0);
  const multi = results.length > 1;

  if (results.length === 1) {
    const only = results[0]!;
    Banner.removePack(only.removedPacks.length, only.sourceAlias);
  } else {
    Banner.removePacks(totalRemoved);
  }

  for (const source of results) {
    const { sourceAlias, removedPacks, skippedPackNames } = source;

    if (multi) {
      console.log('');
      console.log(`▸ ${chalk.bold(sourceAlias)}`);
      printRemovedPacks(removedPacks, '  ');
    } else if (removedPacks.length > 0) {
      console.log('');
      printRemovedPacks(removedPacks, '');
    }

    for (const skipped of skippedPackNames) {
      console.log(`  ${chalk.dim(`📂 ${skipped} — not in ${sourceAlias}`)}`);
    }
  }

  if (totalRemoved > 0) {
    printSyncHint();
  }
}
