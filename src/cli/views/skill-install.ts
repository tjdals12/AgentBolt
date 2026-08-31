import chalk from 'chalk';

import type { SkillInstallResult } from '#catalog/commands/skill-install.js';

import { Banner } from './shared/banner.js';

export function renderSkillInstallResult(result: SkillInstallResult): void {
  const { skill, version, tools } = result;

  Banner.skill.install(skill);
  console.log('');

  console.log(`${chalk.dim('skill:'.padEnd(8))} ${skill}`);
  console.log(`${chalk.dim('version:'.padEnd(8))} ${version}`);

  console.log('');
  for (const { path, status } of tools) {
    const symbol = status === 'installed' ? chalk.green('+') : chalk.yellow('~');
    console.log(`  ${symbol} ${path}`);
  }
}
