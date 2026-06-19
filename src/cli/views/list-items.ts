import chalk from 'chalk';

import type { ListItemsResult } from '#catalog/commands/list-items.js';
import type { Item } from '#catalog/content/item/model.js';
import type { PackDetail } from '#catalog/content/pack/model.js';
import { contentWidth, countToken, ITEM_STYLE, type ItemStyle, wrapText } from '#cli/format.js';

import { Banner } from './shared/banner.js';

function printDimWrapped(text: string, indent: number): void {
  const pad = ' '.repeat(indent);
  for (const line of wrapText(text, contentWidth(indent))) {
    console.log(chalk.dim(`${pad}${line}`));
  }
}

function printSection(style: ItemStyle, items: Item[]): void {
  if (items.length === 0) return;

  console.log('');
  console.log(`    ${countToken(style, items.length)}`);

  for (const item of items) {
    console.log(`         ${chalk.bold(item.name)}`);
    printDimWrapped(item.description, 11);
  }
}

function printPackItems(pack: PackDetail): void {
  console.log(`  📦 ${chalk.bold(pack.name)}`);
  printDimWrapped(pack.description, 5);

  const { skills, agents, guidelines } = pack.items;
  if (skills.length === 0 && agents.length === 0 && guidelines.length === 0) {
    console.log('');
    console.log(chalk.dim('    (no items)'));
    return;
  }

  printSection(ITEM_STYLE.skills, skills);
  printSection(ITEM_STYLE.agents, agents);
  printSection(ITEM_STYLE.guidelines, guidelines);
}

export function renderListItemsResult(result: ListItemsResult): void {
  const { sourceCatalogs, failures } = result;

  Banner.listItems();

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
      console.log('');
      printPackItems(pack);
    }
  });
}
