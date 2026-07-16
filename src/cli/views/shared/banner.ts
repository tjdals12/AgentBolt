import chalk, { type ChalkInstance } from 'chalk';

import { plural } from '#cli/format.js';

function printBanner(color: ChalkInstance, text: string): void {
  console.log(`${color('▌')} ${chalk.bold(`Agent Bolt: ${text}`)}`);
}

export const Banner = {
  init(): void {
    printBanner(chalk.cyan, 'Initialized');
  },

  listPacks(): void {
    printBanner(chalk.cyan, 'Catalog packs');
  },

  listItems(): void {
    printBanner(chalk.cyan, 'Catalog items');
  },

  showItem(count: number): void {
    const text = count > 1 ? `Catalog item · ${count} matches` : 'Catalog item';
    printBanner(chalk.cyan, text);
  },

  addPack(count: number, alias: string): void {
    const text =
      count === 0
        ? `Nothing to add to ${alias}`
        : `Added ${count} ${plural(count, 'pack')} to ${alias}`;
    printBanner(chalk.green, text);
  },

  addPacks(count: number): void {
    const text = count === 0 ? 'Nothing to add' : `Added ${count} ${plural(count, 'pack')}`;
    printBanner(chalk.green, text);
  },

  removePack(count: number, alias: string): void {
    const text =
      count === 0
        ? `Nothing to remove from ${alias}`
        : `Removed ${count} ${plural(count, 'pack')} from ${alias}`;
    printBanner(chalk.red, text);
  },

  removePacks(count: number): void {
    const text = count === 0 ? 'Nothing to remove' : `Removed ${count} ${plural(count, 'pack')}`;
    printBanner(chalk.red, text);
  },

  addItem(count: number, alias: string, pack: string): void {
    const target = `${alias}/${pack}`;
    const text =
      count === 0
        ? `Nothing to add to ${target}`
        : `Added ${count} ${plural(count, 'item')} to ${target}`;
    printBanner(chalk.green, text);
  },

  addItems(count: number): void {
    const text = count === 0 ? 'Nothing to add' : `Added ${count} ${plural(count, 'item')}`;
    printBanner(chalk.green, text);
  },

  removeItem(count: number, alias: string, pack: string): void {
    const target = `${alias}/${pack}`;
    const text =
      count === 0
        ? `Nothing to remove from ${target}`
        : `Removed ${count} ${plural(count, 'item')} from ${target}`;
    printBanner(chalk.red, text);
  },

  sync(changed: boolean): void {
    printBanner(chalk.blue, changed ? 'Sync complete' : 'Already up to date');
  },

  check(drifted: boolean): void {
    printBanner(drifted ? chalk.yellow : chalk.blue, drifted ? 'Drift detected' : 'Up to date');
  },

  catalog: {
    init(): void {
      printBanner(chalk.cyan, 'Catalog initialized');
    },
    newPack(name: string): void {
      printBanner(chalk.cyan, `Created pack ${name}`);
    },
    newSkill(name: string): void {
      printBanner(chalk.cyan, `Created skill ${name}`);
    },
    newAgent(name: string): void {
      printBanner(chalk.cyan, `Created agent ${name}`);
    },
    newGuideline(name: string): void {
      printBanner(chalk.cyan, `Created guideline ${name}`);
    },
    validate(valid: boolean): void {
      printBanner(valid ? chalk.blue : chalk.red, valid ? 'Catalog valid' : 'Catalog invalid');
    },
  },
};
