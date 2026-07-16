import chalk from 'chalk';

import { ITEM_STYLE } from '#cli/format.js';
import { type AddedItemPack, type AddItemResult } from '#catalog/commands/add-item.js';
import { ITEM_TYPES } from '#catalog/content/item/model.js';

import { Banner } from './shared/banner.js';
import { printSyncHint } from './shared/sync-hint.js';

function countItems(items: AddedItemPack['addedItems']): number {
  return ITEM_TYPES.reduce((sum, itemType) => sum + items[itemType].length, 0);
}

function printPackBody(
  pack: AddedItemPack,
  sourceAlias: string,
  indent: string,
  blankBeforeItems: boolean,
): void {
  if (pack.packCreated) {
    console.log(
      chalk.dim(`${indent}(added new pack '${pack.packName}' in source '${sourceAlias}')`),
    );
  }

  if (blankBeforeItems && countItems(pack.addedItems) > 0) {
    console.log('');
  }

  for (const itemType of ITEM_TYPES) {
    for (const itemName of pack.addedItems[itemType]) {
      console.log(
        `${indent}${chalk.green('+')} ${ITEM_STYLE[itemType].icon} ${chalk.bold(itemName)}`,
      );
    }
  }

  for (const itemType of ITEM_TYPES) {
    for (const itemName of pack.skippedItems[itemType]) {
      console.log(
        `${indent}${chalk.dim(`${ITEM_STYLE[itemType].icon} ${itemName} — already in pack '${pack.packName}'`)}`,
      );
    }
  }
}

export function renderAddItemResult(result: AddItemResult): void {
  const { results, failures } = result;
  const totalAdded = results.reduce(
    (sum, source) => sum + source.packs.reduce((s, pack) => s + countItems(pack.addedItems), 0),
    0,
  );
  const single = results.length === 1 && results[0]!.packs.length === 1;

  if (single) {
    const { sourceAlias } = results[0]!;
    const pack = results[0]!.packs[0]!;
    Banner.addItem(countItems(pack.addedItems), sourceAlias, pack.packName);
    printPackBody(pack, sourceAlias, '  ', true);
  } else {
    Banner.addItems(totalAdded);
    for (const source of results) {
      console.log('');
      console.log(`▸ ${chalk.bold(source.sourceAlias)}`);
      for (const pack of source.packs) {
        console.log('');
        console.log(`  📂 ${chalk.bold(pack.packName)}`);
        printPackBody(pack, source.sourceAlias, '    ', false);
      }
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
