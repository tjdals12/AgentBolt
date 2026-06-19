import chalk from 'chalk';

import type { RemoveItemResult } from '#catalog/commands/remove-item.js';
import { ITEM_TYPES } from '#catalog/content/item/model.js';

import { Banner } from './shared/banner.js';
import { ITEM_STYLE } from '#cli/format.js';
import { printSyncHint } from './shared/sync-hint.js';

export function renderRemoveItemResult(result: RemoveItemResult): void {
  const { sourceAlias, packName, packPruned, removedItems, skippedItems } = result;

  const removedCount = ITEM_TYPES.reduce((sum, type) => sum + removedItems[type].length, 0);
  const skippedCount = ITEM_TYPES.reduce((sum, type) => sum + skippedItems[type].length, 0);

  Banner.removeItem(removedCount, sourceAlias, packName);

  if (packPruned) {
    console.log(chalk.dim(`  (pruned empty pack ${packName} from ${sourceAlias})`));
  }

  if (removedCount > 0) {
    console.log('');
    for (const itemType of ITEM_TYPES) {
      const itemNames = removedItems[itemType];
      for (const itemName of itemNames) {
        console.log(`  ${chalk.red('-')} ${ITEM_STYLE[itemType].icon} ${chalk.bold(itemName)}`);
      }
    }
  }

  if (skippedCount > 0) {
    for (const itemType of ITEM_TYPES) {
      const itemNames = skippedItems[itemType];
      for (const itemName of itemNames) {
        console.log(
          `  ${chalk.dim(`${ITEM_STYLE[itemType].icon} ${itemName} - not in ${packName}`)}`,
        );
      }
    }
  }

  if (removedCount > 0) {
    printSyncHint();
  }
}
