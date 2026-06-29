import chalk, { type ChalkInstance } from 'chalk';

import { type ItemType } from '#catalog/content/item/model.js';

const MAX_CONTENT_WIDTH = 100;

export type ItemStyle = { icon: string; color: ChalkInstance; noun: string };

export const ITEM_STYLE = {
  skills: { icon: '🔧', color: chalk.cyan, noun: 'skill' },
  agents: { icon: '🤖', color: chalk.magenta, noun: 'agent' },
  guidelines: { icon: '📋', color: chalk.yellow, noun: 'guideline' },
} satisfies Record<ItemType, ItemStyle>;

export function plural(count: number, singular: string): string {
  return `${singular}${count === 1 ? '' : 's'}`;
}

export function countToken(style: ItemStyle, count: number): string {
  const noun = plural(count, style.noun);
  if (count === 0) return chalk.dim(`${style.icon} 0 ${noun}`);
  return `${style.icon} ${style.color.bold(String(count))} ${style.color(noun)}`;
}

function charWidth(codePoint: number): number {
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo (e.g. ᄀ)
    (codePoint >= 0x2e80 && codePoint <= 0x303e) || // CJK radicals (e.g. ⼀)
    (codePoint >= 0x3041 && codePoint <= 0x33ff) || // Hiragana, Katakana, CJK symbols (e.g. あ)
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK Extension A (e.g. 㐀)
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK Unified Ideographs (e.g. 中)
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul syllables (e.g. 가)
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compatibility Ideographs (e.g. 豈)
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || // CJK Compatibility Forms (e.g. ︱)
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // Fullwidth alphanumerics (e.g. Ａ)
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) || // Fullwidth currency symbols (e.g. ￦)
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) // Emoji (e.g. 😀)
  ) {
    return 2;
  }
  return 1;
}

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch.codePointAt(0) ?? 0);
  return width;
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function visibleWidth(text: string): number {
  return displayWidth(text.replace(ANSI_PATTERN, ''));
}

export function contentWidth(indent: number): number {
  return Math.max(Math.min(process.stdout.columns ?? 80, MAX_CONTENT_WIDTH) - indent, 20);
}

export function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && displayWidth(candidate) > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export type PackCounts = { skills: number; agents: number; guidelines: number };

export type AlignedPackRow = { name: string; paddedName: string; counts: string };

export function alignPackRows(rows: { name: string; counts: PackCounts }[]): AlignedPackRow[] {
  const itemTypes = ['skills', 'agents', 'guidelines'] as const;
  const nameWidth = Math.max(0, ...rows.map((row) => row.name.length));
  const columnWidths = { skills: 0, agents: 0, guidelines: 0 };
  for (const row of rows) {
    for (const itemType of itemTypes) {
      const token = countToken(ITEM_STYLE[itemType], row.counts[itemType]);
      columnWidths[itemType] = Math.max(columnWidths[itemType], visibleWidth(token));
    }
  }

  return rows.map((row) => {
    const counts = itemTypes
      .map((itemType) => {
        const token = countToken(ITEM_STYLE[itemType], row.counts[itemType]);
        const padding = ' '.repeat(columnWidths[itemType] - visibleWidth(token));
        return `${token}${padding}`;
      })
      .join('  ');
    return { name: row.name, paddedName: row.name.padEnd(nameWidth), counts };
  });
}
