import chalk from 'chalk';

import { contentWidth, ITEM_STYLE, wrapText, type ItemStyle } from '#cli/format.js';
import type { ShowItemResult, ShownItem } from '#catalog/commands/show-item.js';
import type { GuidelineRecommendation, ToolConfig } from '#catalog/content/item/schema.js';

import { Banner } from './shared/banner.js';

function printHeader(style: ItemStyle, breadcrumb: string, name: string): void {
  console.log(`${style.icon} ${chalk.bold(name)}`);
  console.log(chalk.dim(`  ${breadcrumb}`));
}

function printSectionHeader(
  style: ItemStyle,
  label: string,
  options: { count?: number; note?: string } = {},
) {
  const texts: string[] = [style.color.bold(label)];

  if (options.count !== undefined) {
    texts.push(chalk.dim(` · ${options.count}`));
  }

  if (options.note) {
    texts.push(style.color(`${options.note}`));
  }

  console.log('');
  console.log(texts.join(' '));
}

function printWrapped(text: string, indent: number): void {
  const pad = ' '.repeat(indent);
  const lines = wrapText(text, contentWidth(indent));
  for (const line of lines) {
    console.log(chalk.dim(`${pad}${line}`));
  }
}

function printIndentedBody(text: string): void {
  const lines = text.trim().split('\n');
  for (const line of lines) {
    console.log(line.trim() === '' ? '' : chalk.dim(`  ${line}`));
  }
}

function printToolConfig(style: ItemStyle, toolConfig: ToolConfig | undefined) {
  printSectionHeader(style, 'tool settings');

  const tools = toolConfig
    ? Object.entries(toolConfig).filter(([, config]) => Object.keys(config).length > 0)
    : [];

  if (tools.length === 0) {
    console.log(chalk.dim('  (none)'));
  }

  for (const [id, config] of tools) {
    console.log(`  ${chalk.bold(id)}`);
    const settings = Object.entries(config);
    for (const [key, value] of settings) {
      const display = Array.isArray(value) ? value.join(', ') : String(value);
      console.log(`    ${chalk.dim(`${key}:`)} ${display}`);
    }
  }
}

function printAppliesTo(style: ItemStyle, recommended: GuidelineRecommendation): void {
  printSectionHeader(style, 'applies to', { note: 'recommended' });
  const value = recommended.load === 'always' ? 'all files' : recommended.glob.join(', ');
  console.log(chalk.dim(`  ${value}`));
}

function printSkill(
  style: ItemStyle,
  breadcrumb: string,
  skill: Extract<ShownItem, { type: 'skills' }>,
) {
  const { name, description, toolConfig, assets, instructions } = skill;

  printHeader(style, breadcrumb, name);

  printSectionHeader(style, 'description');
  printWrapped(description, 2);

  printSectionHeader(style, 'instructions');
  printIndentedBody(instructions);

  printToolConfig(style, toolConfig);

  if (assets.length) {
    printSectionHeader(style, 'assets', { count: assets.length });
    for (const asset of assets) {
      console.log(chalk.dim(`  ${asset}`));
    }
  }
}

function printAgent(
  style: ItemStyle,
  breadcrumb: string,
  agent: Extract<ShownItem, { type: 'agents' }>,
) {
  const { name, description, toolConfig, instructions } = agent;

  printHeader(style, breadcrumb, name);

  printSectionHeader(style, 'description');
  printWrapped(description, 2);

  printSectionHeader(style, 'instructions');
  printIndentedBody(instructions);

  printToolConfig(style, toolConfig);
}

function printGuideline(
  style: ItemStyle,
  breadcrumb: string,
  guideline: Extract<ShownItem, { type: 'guidelines' }>,
) {
  const { name, description, recommended, body } = guideline;

  printHeader(style, breadcrumb, name);

  printSectionHeader(style, 'description');
  printWrapped(description, 2);

  printSectionHeader(style, 'body');
  printIndentedBody(body);

  printAppliesTo(style, recommended);
}

export function renderShowItemResult(result: ShowItemResult): void {
  const { sourceAlias, packName, items } = result;

  Banner.showItem(items.length);

  items.forEach((item) => {
    console.log('');

    const style = ITEM_STYLE[item.type];
    const breadcrumb = `${sourceAlias}/${packName} · ${style.noun}`;

    switch (item.type) {
      case 'skills':
        printSkill(style, breadcrumb, item);
        break;
      case 'agents':
        printAgent(style, breadcrumb, item);
        break;
      case 'guidelines':
        printGuideline(style, breadcrumb, item);
        break;
    }
  });
}
