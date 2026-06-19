import chalk from 'chalk';

import type { CheckResult } from '#catalog/commands/check.js';

import { Banner } from './shared/banner.js';
import {
  changeSummary,
  countChanges,
  printToolReport,
  type StatusStyles,
} from './shared/report.js';
import { printSyncHint } from './shared/sync-hint.js';

const STATUS_STYLES: StatusStyles = {
  installed: { symbol: '+', color: chalk.yellow, label: 'missing' },
  updated: { symbol: '~', color: chalk.magenta, label: 'drifted' },
  removed: { symbol: '-', color: chalk.red, label: 'orphaned' },
};

export function renderCheckResult(result: CheckResult): void {
  const counts = countChanges(result);
  const changed = counts.total > 0;

  Banner.check(changed);

  for (const toolCheckResult of result) {
    printToolReport(toolCheckResult, STATUS_STYLES);
  }

  if (changed) {
    console.log('');
    console.log(changeSummary(counts, STATUS_STYLES));
    printSyncHint();
  }
}
