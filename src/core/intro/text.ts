import chalk from 'chalk';

/** Default wordmark line. Variants may override via `Intro.title`. */
export const DEFAULT_TITLE = `${chalk.yellow('⚡')} ${chalk.bold('AgentBolt')}`;

const QUICK_START: Array<{ command: string; description: string }> = [
  { command: 'list-packs', description: 'Browse the catalog' },
  { command: 'add-pack', description: 'Pick what to install' },
  { command: 'sync', description: 'Install into your agents' },
];

/**
 * Welcome text shown in the right column, identical across every intro variant.
 * Agents are omitted on purpose — the next screen is the tool picker, so listing
 * them here would just repeat it.
 */
export function buildWelcomeLines(title: string = DEFAULT_TITLE): string[] {
  const commandWidth = Math.max(...QUICK_START.map(({ command }) => command.length));

  return [
    title,
    chalk.dim('One catalog, every agent'),
    '',
    chalk.bold('init will:'),
    chalk.dim('  • Create the .agent-bolt/ workspace'),
    chalk.dim('  • Set up your tools and catalog sources'),
    '',
    chalk.bold('Quick start after setup:'),
    ...QUICK_START.map(({ command, description }) => {
      const paddedCommand = chalk.yellow(command.padEnd(commandWidth));
      return `  ${paddedCommand}  ${chalk.dim(description)}`;
    }),
    '',
    chalk.cyan('Press Enter to continue… '),
  ];
}
