import chalk from 'chalk';

import type { RemovePackResult } from '#catalog/commands/remove-pack.js';
import { alignPackRows } from '#cli/format.js';

import { printSyncHint } from './shared/sync-hint.js';
import { Banner } from './shared/banner.js';

export function renderRemovePackResult(result: RemovePackResult): void {
  const { sourceAlias, removedPacks, skippedPackNames } = result;

  Banner.removePack(removedPacks.length, sourceAlias);

  if (removedPacks.length === 0) {
    for (const name of skippedPackNames) {
      console.log(`  ${chalk.dim(`📂 ${name} — not in ${sourceAlias}`)}`);
    }
    return;
  }

  const rows = alignPackRows(
    removedPacks.map((pack) => ({
      name: pack.name,
      counts: {
        skills: pack.skills.length,
        agents: pack.agents.length,
        guidelines: pack.guidelines.length,
      },
    })),
  );

  console.log('');
  for (const row of rows) {
    console.log(`${chalk.red('-')} 📂 ${chalk.bold(row.paddedName)}  ${row.counts}`);
  }

  for (const skippedPackName of skippedPackNames) {
    console.log(`  ${chalk.dim(`📂 ${skippedPackName} — not in ${sourceAlias}`)}`);
  }

  printSyncHint();
}
