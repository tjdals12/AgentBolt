import chalk from 'chalk';

import type { RemovedItemPack, RemoveItemResult } from '#catalog/commands/remove-item.js';
import { ITEM_TYPES } from '#catalog/content/item/model.js';

import { Banner } from './shared/banner.js';
import { ITEM_STYLE } from '#cli/format.js';
import { printSyncHint } from './shared/sync-hint.js';

function countItems(items: RemovedItemPack['removedItems']): number {
  return ITEM_TYPES.reduce((sum, itemType) => sum + items[itemType].length, 0);
}

function printPackBody(
  pack: RemovedItemPack,
  sourceAlias: string,
  indent: string,
  blankBeforeItems: boolean,
): void {
  if (pack.packPruned) {
    console.log(
      chalk.dim(`${indent}(removed empty pack '${pack.packName}' from source '${sourceAlias}')`),
    );
  }

  if (blankBeforeItems && countItems(pack.removedItems) > 0) {
    console.log('');
  }

  for (const itemType of ITEM_TYPES) {
    for (const itemName of pack.removedItems[itemType]) {
      console.log(
        `${indent}${chalk.red('-')} ${ITEM_STYLE[itemType].icon} ${chalk.bold(itemName)}`,
      );
    }
  }

  for (const itemType of ITEM_TYPES) {
    for (const itemName of pack.skippedItems[itemType]) {
      console.log(
        `${indent}${chalk.dim(`${ITEM_STYLE[itemType].icon} ${itemName} — not in pack '${pack.packName}'`)}`,
      );
    }
  }
}

export function renderRemoveItemResult(result: RemoveItemResult): void {
  const { results, failures } = result;
  const totalRemoved = results.reduce(
    (sum, source) => sum + source.packs.reduce((s, pack) => s + countItems(pack.removedItems), 0),
    0,
  );
  const single = results.length === 1 && results[0]!.packs.length === 1;

  if (single) {
    const { sourceAlias } = results[0]!;
    const pack = results[0]!.packs[0]!;
    Banner.removeItem(countItems(pack.removedItems), sourceAlias, pack.packName);
    printPackBody(pack, sourceAlias, '  ', true);
  } else {
    Banner.removeItems(totalRemoved);
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

  if (totalRemoved > 0) {
    printSyncHint();
  }
}
