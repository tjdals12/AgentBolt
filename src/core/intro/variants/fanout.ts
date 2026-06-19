import chalk from 'chalk';

import type { Intro } from '../types.js';
import { brightnessRamp } from '../paint.js';

// A source box draws itself in, charges with a bolt, then fans out to a row of
// agent nodes — the "one catalog, every agent" idea. A per-frame cyan ramp
// brightens the whole logo as it builds.

// Full Unicode (box-drawing) is safe on macOS/Linux and modern Windows
// terminals; fall back to ASCII elsewhere.
const supportsUnicode =
  process.platform !== 'win32' ||
  Boolean(process.env.WT_SESSION) ||
  Boolean(process.env.TERM_PROGRAM);

const CHARS = supportsUnicode
  ? {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      trunk: '┬',
      branch: '├',
      arrow: '▸',
      node: '○',
    }
  : {
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      horizontal: '-',
      vertical: '|',
      trunk: '+',
      branch: '+',
      arrow: '>',
      node: 'o',
    };

const {
  topLeft: TL,
  topRight: TR,
  bottomLeft: BL,
  bottomRight: BR,
  horizontal: H,
  vertical: V,
  trunk: TRUNK,
  branch: BRANCH,
  arrow: ARROW,
  node: NODE,
} = CHARS;

const INNER_WIDTH = 6;
const ART_WIDTH = 13;
const ART_COLUMN_WIDTH = 17;
const blank = ' '.repeat(ART_WIDTH);

const boltContent = supportsUnicode ? '  ⚡  ' : '  /\\  ';

const cornersTop = `${TL}${' '.repeat(INNER_WIDTH)}${TR}`;
const cornersBottom = `${BL}${' '.repeat(INNER_WIDTH)}${BR}`;
const boxTop = `${TL}${H.repeat(INNER_WIDTH)}${TR}`;
const boxEmpty = `${V}${' '.repeat(INNER_WIDTH)}${V}`;
const boxBolt = `${V}${boltContent}${V}`;
const boxBottom = `${BL}${H.repeat(INNER_WIDTH)}${BR}`;
const boxTrunk = `${BL}${H.repeat(2)}${TRUNK}${H.repeat(3)}${BR}`;

const trunkDrop = `${' '.repeat(3)}${V}`;
const branchMid = `${' '.repeat(3)}${BRANCH}${H.repeat(6)}${ARROW} ${NODE}`;
const branchLast = `${' '.repeat(3)}${BL}${H.repeat(6)}${ARROW} ${NODE}`;

const emptyContent = [boxEmpty, boxEmpty, boxEmpty];
const fan = [trunkDrop, branchMid, trunkDrop, branchMid, trunkDrop, branchLast];
const pad = (count: number): string[] => Array.from({ length: count }, () => blank);

const frames = [
  pad(11),
  [cornersTop, blank, blank, blank, cornersBottom, ...pad(6)],
  [boxTop, ...emptyContent, boxBottom, ...pad(6)],
  [boxTop, boxEmpty, boxBolt, boxEmpty, boxBottom, ...pad(6)],
  [boxTop, boxEmpty, boxBolt, boxEmpty, boxTrunk, trunkDrop, branchMid, ...pad(4)],
  [boxTop, boxEmpty, boxBolt, boxEmpty, boxTrunk, ...fan],
  [boxTop, boxEmpty, boxBolt, boxEmpty, boxTrunk, ...fan],
];

const BRIGHTNESS = [
  chalk.dim.cyan,
  chalk.dim.cyan,
  chalk.cyan,
  chalk.cyan,
  chalk.cyanBright,
  chalk.bold.cyanBright,
  chalk.bold.cyanBright,
];

export const fanout: Intro = {
  id: 'fanout',
  label: 'Fan-out — one catalog box fans out to agent nodes (cyan ramp)',
  minWidth: 62,
  artColumnWidth: ART_COLUMN_WIDTH,
  interval: 130,
  frames,
  peakFrameIndex: 5,
  title: chalk.bold('⚡ AgentBolt'),
  // ⚡ is two columns wide, so pad the art column by display width.
  paintArt: brightnessRamp({
    ramp: BRIGHTNESS,
    fallback: chalk.bold.cyanBright,
    width: ART_COLUMN_WIDTH,
    wide: true,
  }),
};
