import { Separator } from '@inquirer/prompts';
import chalk from 'chalk';

import type { ItemType } from '#catalog/content/item/model.js';

import { ITEM_STYLE, visibleWidth } from './format.js';

export function itemSectionHeader(itemType: ItemType, rowWidth: number): Separator {
  const style = ITEM_STYLE[itemType];
  const label = `${style.icon} ${itemType}`;
  const trailing = Math.max(3, rowWidth - visibleWidth(label) - 3);
  const line = `${chalk.dim('──')} ${style.color.bold(label)} ${chalk.dim('─'.repeat(trailing))}`;
  return new Separator(line);
}
