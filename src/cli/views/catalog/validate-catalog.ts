import type { ValidateCatalogResult } from '#catalog/commands/catalog/validate-catalog.js';
import { ITEM_TYPES } from '#catalog/content/item/model.js';
import { contentWidth, countToken, ITEM_STYLE, plural, wrapText } from '#cli/format.js';
import chalk from 'chalk';
import { Banner } from '../shared/banner.js';

export function renderValidateCatalogResult(result: ValidateCatalogResult): void {
  const { catalogCounts, validationIssues } = result;

  const { errorCount, warningCount } = validationIssues.reduce(
    (acc, cur) => {
      const { severity } = cur;

      switch (severity) {
        case 'error':
          acc.errorCount += 1;
          break;
        case 'warning':
          acc.warningCount += 1;
          break;
      }

      return acc;
    },
    { errorCount: 0, warningCount: 0 },
  );

  Banner.catalog.validate(errorCount === 0);

  const { packs, items } = catalogCounts;
  const itemTokens = ITEM_TYPES.map((itemType) =>
    countToken(ITEM_STYLE[itemType], items[itemType]),
  );

  console.log('');
  console.log(`${chalk.bold(String(packs))} ${plural(packs, 'pack')}   ${itemTokens.join('  ')}`);

  if (validationIssues.length === 0) {
    console.log('');
    console.log(chalk.dim('no problems found'));
    return;
  }

  for (const issue of validationIssues) {
    const { severity, location, message } = issue;
    const symbol = severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠');

    console.log('');
    console.log(`${symbol} ${chalk.bold(location)}`);

    const lines = message.split('\n').map((line) => line.trim());
    for (const line of lines) {
      if (line === '') {
        console.log('');
      } else {
        const texts = wrapText(line, contentWidth(2));
        for (const text of texts) {
          console.log(chalk.dim(`  ${text}`));
        }
      }
    }
  }

  console.log('');

  const summary: string[] = [];
  if (errorCount > 0) {
    summary.push(chalk.red(`${errorCount} ${plural(errorCount, 'error')}`));
  }
  if (warningCount > 0) {
    summary.push(chalk.yellow(`${warningCount} ${plural(warningCount, 'warning')}`));
  }

  console.log(summary.join(chalk.dim(' · ')));
}
