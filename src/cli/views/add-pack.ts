import chalk from 'chalk';

import type { AddPackResult } from '#catalog/commands/add-pack.js';
import { countToken, ITEM_STYLE } from '#cli/format.js';

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

  console.log('');
  for (const addedPack of addedPacks) {
    const { name, skills, agents, guidelines } = addedPack;

    const parts: string[] = [];
    if (skills.length > 0) {
      parts.push(countToken(ITEM_STYLE.skills, skills.length));
    }

    if (agents.length > 0) {
      parts.push(countToken(ITEM_STYLE.agents, agents.length));
    }

    const guidelineCount = Object.keys(guidelines).length;
    if (guidelineCount > 0) {
      parts.push(countToken(ITEM_STYLE.guidelines, guidelineCount));
    }

    console.log(
      `${chalk.green('+')} 📂 ${chalk.bold(name)}${parts.length ? `   ${parts.join('  ')}` : ''}`,
    );
  }

  for (const skippedPackName of skippedPackNames) {
    console.log(`  ${chalk.dim(`📂 ${skippedPackName} — already in ${sourceAlias}`)}`);
  }

  printSyncHint();
}
