import chalk from 'chalk';

import type { ListPacksResult } from '#catalog/commands/list-packs.js';
import { contentWidth, countToken, ITEM_STYLE, wrapText } from '#cli/format.js';

import { Banner } from './shared/banner.js';

export function renderListPacksResult(result: ListPacksResult): void {
  const { sourceCatalogs, failures } = result;

  if (process.stdout.isTTY) {
    console.log('');
  }

  Banner.listPacks();

  failures.forEach((message) => {
    const [first, ...rest] = message.split('\n');
    console.log(chalk.yellow(`⚠ ${first}`));
    for (const line of rest) {
      console.log(line);
    }
  });

  if (sourceCatalogs.length === 0) {
    if (failures.length === 0) {
      console.log('');
      console.log(chalk.dim("No catalog sources configured. Run 'agent-bolt init' to add one."));
    }
    return;
  }

  sourceCatalogs.forEach((sourceCatalog) => {
    const { alias, type, packs } = sourceCatalog;

    console.log('');

    console.log(`▸ ${chalk.bold(alias)}  ${chalk.dim(`(${type})`)}`);

    if (packs.length === 0) {
      console.log('');
      console.log(chalk.dim('  (no packs)'));
      return;
    }

    for (const pack of packs) {
      const { name, description } = pack;

      console.log('');
      console.log(`  📦 ${chalk.bold(name)}`);

      const lines = wrapText(description, contentWidth(5));
      for (const line of lines) {
        console.log(chalk.dim(`     ${line}`));
      }

      const counts = [
        countToken(ITEM_STYLE.skills, pack.counts.skills),
        countToken(ITEM_STYLE.agents, pack.counts.agents),
        countToken(ITEM_STYLE.guidelines, pack.counts.guidelines),
      ].join('  ');
      console.log(`     ${counts}`);
    }
  });
}
