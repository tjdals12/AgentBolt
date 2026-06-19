import chalk from 'chalk';

export function printSyncHint(): void {
  console.log('');
  console.log(chalk.dim('Next, run this to install:'));
  console.log(`  ${chalk.bold('agent-bolt sync')}`);
}
