import chalk, { type ChalkInstance } from 'chalk';

import { contentWidth, countToken, ITEM_STYLE, wrapText } from '#cli/format.js';
import type { ChangeStatus, SyncChange } from '#catalog/install/model.js';
import type { ToolId } from '#catalog/tool/model.js';
import { getTool } from '#catalog/tool/catalog.js';

export type ToolReport = {
  tool: ToolId;
  counts: { skills: number; agents: number; guidelines: number };
  changes: SyncChange[];
};

export type ChangeCounts = { installed: number; updated: number; removed: number; total: number };

export type StatusStyle = { symbol: string; color: ChalkInstance; label: string };
export type StatusStyles = Record<ChangeStatus, StatusStyle>;

const STATUS_ORDER: ChangeStatus[] = ['installed', 'updated', 'removed'];

export function countChanges(reports: ToolReport[]): ChangeCounts {
  const counts: ChangeCounts = { installed: 0, updated: 0, removed: 0, total: 0 };
  for (const report of reports) {
    counts.total += report.changes.length;
    for (const change of report.changes) {
      counts[change.status] += 1;
    }
  }
  return counts;
}

export function changeSummary(counts: ChangeCounts, styles: StatusStyles): string {
  const parts = STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => {
    const { color, label } = styles[status];
    return color(`${counts[status]} ${label}`);
  });
  return parts.join(chalk.dim(' · '));
}

function printStatusGroup(style: StatusStyle, status: ChangeStatus, changes: SyncChange[]) {
  const items = changes.filter((change) => change.status === status);
  if (items.length === 0) return;

  const { symbol, color, label } = style;
  console.log(`  ${color(symbol)} ${color(`${items.length} ${label}`)}`);
  const labels = items.map((change) => change.label).join(', ');
  const lines = wrapText(labels, contentWidth(4));
  for (const line of lines) {
    console.log(chalk.dim(`    ${line}`));
  }
}

export function printToolReport(report: ToolReport, styles: StatusStyles): void {
  const { tool: toolId, counts, changes } = report;
  const { skills, agents, guidelines } = counts;

  const tool = getTool(toolId);

  const configured = skills + agents + guidelines;
  const changed = changes.length;
  if (configured === 0 && changed === 0) return;

  const parts: string[] = [];

  if (skills > 0) {
    parts.push(countToken(ITEM_STYLE.skills, skills));
  }

  if (agents > 0) {
    parts.push(countToken(ITEM_STYLE.agents, agents));
  }

  if (guidelines > 0) {
    parts.push(countToken(ITEM_STYLE.guidelines, guidelines));
  }

  console.log('');
  console.log(`${chalk.bold(tool.displayName)}${parts.length ? `   ${parts.join('  ')}` : ''}`);

  if (changed > 0) {
    for (const status of STATUS_ORDER) {
      printStatusGroup(styles[status], status, changes);
    }
  } else {
    console.log(chalk.dim('  up to date'));
  }
}
