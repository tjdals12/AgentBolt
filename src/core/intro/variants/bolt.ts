import chalk from 'chalk';

import type { Intro } from '../types.js';
import { scheduledCharge, verticalGradient } from '../paint.js';

// A stylized ASCII lightning bolt: a hash-filled stroke steps down-left, juts
// out sideways at a flat-cut jog, then continues down-left to a point. Plain
// ASCII (# " /), so it renders anywhere. A vertical white→amber gradient cools
// from the white-hot strike to the amber tip.
const BOLT = [
  '       ###-',
  '      ####"',
  '     ####"',
  '    ####"',
  '   #########"',
  '   """""####"',
  '       ####"',
  '      ####"',
  '     ####',
  '    ###"',
  '   ##"',
  '  /"',
];

const ART_WIDTH = 14;
const ART_COLUMN_WIDTH = 17;
const blank = ' '.repeat(ART_WIDTH);

const ROWS = BOLT.length;
const blanks = (count: number): string[] => Array.from({ length: count }, () => blank);
const reveal = (count: number): string[] => [...BOLT.slice(0, count), ...blanks(ROWS - count)];

const peak = reveal(ROWS);

// The strike reveals top-to-bottom (frames 0–6), then the full bolt holds and
// flickers (frames 6–10) before the loop restarts. The per-frame charge dips
// and flashes while the hold frames stay full — a lightning blink. Values above
// 1 push the gradient toward white-hot (channels clamp at 255).
const CHARGE = [0.45, 0.6, 0.75, 0.85, 0.95, 1, 1, 1.35, 0.35, 1.35, 0.4];

const frames = [
  reveal(0),
  reveal(3),
  reveal(5),
  reveal(6),
  reveal(8),
  reveal(10),
  peak,
  peak,
  peak,
  peak,
  peak,
];

export const bolt: Intro = {
  id: 'bolt',
  label: 'Lightning bolt — strikes top-down, then flickers (white→amber)',
  minWidth: 62,
  artColumnWidth: ART_COLUMN_WIDTH,
  interval: 110,
  frames,
  peakFrameIndex: 6,
  title: chalk.bold('AgentBolt'),
  paintArt: verticalGradient({
    top: [255, 250, 214],
    foot: [255, 150, 20],
    charge: scheduledCharge(CHARGE),
    width: ART_COLUMN_WIDTH,
  }),
};
