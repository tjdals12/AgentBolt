import chalk from 'chalk';

import type { RemovePackResult } from '#catalog/commands/remove-pack.js';
import { countToken, ITEM_STYLE } from '#cli/format.js';

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

  console.log('');
  for (const removedPack of removedPacks) {
    const { name, skills, agents, guidelines } = removedPack;

    const parts: string[] = [];
    if (skills.length > 0) {
      parts.push(countToken(ITEM_STYLE.skills, skills.length));
    }
    if (agents.length > 0) {
      parts.push(countToken(ITEM_STYLE.agents, agents.length));
    }
    if (guidelines.length > 0) {
      parts.push(countToken(ITEM_STYLE.guidelines, guidelines.length));
    }

    console.log(
      `${chalk.red('-')} 📂 ${chalk.bold(name)}${parts.length ? `   ${parts.join('  ')}` : ''}`,
    );
  }

  for (const skippedPackName of skippedPackNames) {
    console.log(`  ${chalk.dim(`📂 ${skippedPackName} — not in ${sourceAlias}`)}`);
  }

  printSyncHint();
}
