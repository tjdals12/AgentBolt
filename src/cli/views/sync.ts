import chalk from 'chalk';

import type { SyncResult } from '#catalog/commands/sync.js';

import { Banner } from './shared/banner.js';
import {
  changeSummary,
  countChanges,
  printToolReport,
  type StatusStyles,
} from './shared/report.js';

const STATUS_STYLES: StatusStyles = {
  installed: { symbol: '+', color: chalk.green, label: 'installed' },
  updated: { symbol: '~', color: chalk.yellow, label: 'updated' },
  removed: { symbol: '-', color: chalk.red, label: 'removed' },
};

export function renderSyncResult(result: SyncResult): void {
  const counts = countChanges(result);
  const changed = counts.total > 0;

  Banner.sync(changed);

  for (const toolSyncResult of result) {
    printToolReport(toolSyncResult, STATUS_STYLES);
  }

  if (changed) {
    console.log('');
    console.log(changeSummary(counts, STATUS_STYLES));
  }
}
