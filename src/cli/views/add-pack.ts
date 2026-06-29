import chalk from 'chalk';

import type { AddPackResult } from '#catalog/commands/add-pack.js';
import { alignPackRows } from '#cli/format.js';

import { printSyncHint } from './shared/sync-hint.js';
import { Banner } from './shared/banner.js';

export function renderAddPackResult(result: AddPackResult): void {
  const { sourceAlias, addedPacks, skippedPackNames } = result;

  Banner.addPack(addedPacks.length, sourceAlias);

  if (addedPacks.length === 0) {
    for (const name of skippedPackNames) {
      console.log(`  ${chalk.dim(`📂 ${name} — already in ${sourceAlias}`)}`);
    }
    return;
  }

  const rows = alignPackRows(
    addedPacks.map((pack) => ({
      name: pack.name,
      counts: {
        skills: pack.skills.length,
        agents: pack.agents.length,
        guidelines: Object.keys(pack.guidelines).length,
      },
    })),
  );

  console.log('');
  for (const row of rows) {
    console.log(`${chalk.green('+')} 📂 ${chalk.bold(row.paddedName)}  ${row.counts}`);
  }

  for (const skippedPackName of skippedPackNames) {
    console.log(`  ${chalk.dim(`📂 ${skippedPackName} — already in ${sourceAlias}`)}`);
  }

  printSyncHint();
}
