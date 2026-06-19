import type { Intro } from '../types.js';
import { horizontalGradient, sineCharge } from '../paint.js';

// A tide seen from above: water fills the field from the left, and its edge —
// the foam line — surges right then drains back left, over and over. The edge
// is rendered with left-eighth block characters so the waterline stays smooth
// rather than stair-stepped, and two long vertical sine waves are layered so it
// undulates organically down the column. One phase loop = one full surge+drain,
// so the animation repeats seamlessly. A horizontal violet→blue gradient lights
// up the surge as it crashes in.
const ROWS = 13; // matches the welcome text height
const COLUMNS = 16; // width of the water field
const FRAMES = 20; // phase steps for one seamless surge+drain

const TIDE_BASE = 8.2; // mid waterline position (columns from the left)
const TIDE_AMP = 6.4; // how far the tide surges right / drains left
const FOAM_AMP = 1.9; // depth of the wavy foam edge
const WAVES_A = 1; // long crest running the full height
const WAVES_B = 2; // shorter ripple layered on top

// Left-eighth blocks: a cell that is 0..1 full of water maps onto these so the
// waterline can land between columns.
const SHADES = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];

const ART_COLUMN_WIDTH = 20;

function waterlineAt(row: number, phase: number): number {
  const tide = TIDE_BASE + TIDE_AMP * Math.sin(phase);
  const foam =
    FOAM_AMP *
    (0.62 * Math.sin((2 * Math.PI * WAVES_A * row) / ROWS + phase) +
      0.38 * Math.sin((2 * Math.PI * WAVES_B * row) / ROWS - phase));
  return tide + foam;
}

function cell(fill: number): string {
  if (fill >= 1) return '█';
  if (fill <= 0) return ' ';
  return SHADES[Math.round(fill * 8)]!;
}

function buildFrame(phase: number): string[] {
  return Array.from({ length: ROWS }, (_, row) => {
    const edge = waterlineAt(row, phase);
    let line = '';
    for (let column = 0; column < COLUMNS; column++) {
      line += cell(edge - column);
    }
    return line;
  });
}

const frames = Array.from({ length: FRAMES }, (_, i) => buildFrame((2 * Math.PI * i) / FRAMES));

export const tide: Intro = {
  id: 'tide',
  label: 'Tide — water surges in from the left and drains back (violet→blue)',
  minWidth: 66,
  artColumnWidth: ART_COLUMN_WIDTH,
  interval: 70,
  frames,
  // High tide (phase ≈ π/2) is the fullest frame — the static fallback.
  peakFrameIndex: Math.round(FRAMES / 4),
  paintArt: horizontalGradient({
    left: [99, 64, 210],
    right: [96, 205, 252],
    // A gentle global breath layered on the tide's motion, so the water feels
    // alive rather than flat.
    charge: sineCharge(0.84, 0.16, FRAMES),
    width: ART_COLUMN_WIDTH,
  }),
};
