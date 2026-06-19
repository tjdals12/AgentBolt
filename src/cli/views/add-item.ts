import chalk from 'chalk';

import { ITEM_STYLE } from '#cli/format.js';
import { type AddItemResult } from '#catalog/commands/add-item.js';
import { ITEM_TYPES } from '#catalog/content/item/model.js';

import { Banner } from './shared/banner.js';
import { printSyncHint } from './shared/sync-hint.js';

export function renderAddItemResult(result: AddItemResult): void {
  const { sourceAlias, packName, packCreated, addedItems, skippedItems } = result;

  const addedCount = ITEM_TYPES.reduce((sum, type) => sum + addedItems[type].length, 0);
  const skippedCount = ITEM_TYPES.reduce((sum, type) => sum + skippedItems[type].length, 0);

  Banner.addItem(addedCount, sourceAlias, packName);

  if (packCreated) {
    console.log(chalk.dim(`  (created pack ${packName} in ${sourceAlias})`));
  }

  if (addedCount > 0) {
    console.log('');
    for (const itemType of ITEM_TYPES) {
      const itemNames = addedItems[itemType];
      for (const itemName of itemNames) {
        console.log(`  ${chalk.green('+')} ${ITEM_STYLE[itemType].icon} ${chalk.bold(itemName)}`);
      }
    }
  }

  if (skippedCount > 0) {
    for (const itemType of ITEM_TYPES) {
      const itemNames = skippedItems[itemType];
      for (const itemName of itemNames) {
        console.log(
          `  ${chalk.dim(`${ITEM_STYLE[itemType].icon} ${itemName} - already in ${packName}`)}`,
        );
      }
    }
  }

  if (addedCount > 0) {
    printSyncHint();
  }
}
