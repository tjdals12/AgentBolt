import type { Intro } from '../types.js';
import { sineCharge, verticalGradient } from '../paint.js';

// An equalizer-style wave built from AgentBolt's ▌ bar motif: a row of vertical
// bars whose fill heights trace a sine curve. Advancing the phase each frame
// sweeps the crest left→right, reading as an energy pulse running through the
// bars. Full blocks render crisply wherever the banner's ▌ does. A vertical
// blue→violet gradient gives it an energized, electric feel.
const ROWS = 13; // matches the welcome text height
const COLUMNS = 18; // width of the wave
const FRAMES = 18; // phase steps for one seamless loop
const BASELINE = 7; // mid fill height (rows from the bottom)
const AMPLITUDE = 5; // crest/trough offset from the baseline
const WAVELENGTH = 9; // columns per wave period (≈ two crests across the width)

const FULL = '█';
const ART_COLUMN_WIDTH = 20;

function heightAt(column: number, phase: number): number {
  // Subtracting the phase makes a fixed crest move toward higher columns as the
  // phase grows — i.e. left→right.
  const angle = (2 * Math.PI * column) / WAVELENGTH - phase;
  return Math.round(BASELINE + AMPLITUDE * Math.sin(angle));
}

function buildFrame(phase: number): string[] {
  const heights = Array.from({ length: COLUMNS }, (_, column) => heightAt(column, phase));
  // Render top→bottom: a cell fills once its column's height reaches that row,
  // counted from the bottom up, so the bars stand on a common baseline.
  return Array.from({ length: ROWS }, (_, row) => {
    const fromBottom = ROWS - row;
    return heights.map((height) => (height >= fromBottom ? FULL : ' ')).join('');
  });
}

const frames = Array.from({ length: FRAMES }, (_, i) => buildFrame((2 * Math.PI * i) / FRAMES));

export const wordmarkWave: Intro = {
  id: 'wordmark-wave',
  label: 'Wordmark wave — an equalizer pulse sweeps the ▌ bars (blue→violet)',
  minWidth: 66,
  artColumnWidth: ART_COLUMN_WIDTH,
  interval: 80,
  frames,
  // Any frame is representative for the static (non-animated) fallback.
  peakFrameIndex: 0,
  paintArt: verticalGradient({
    top: [56, 189, 248],
    foot: [139, 92, 246],
    // A gentle global breath layered on the wave's motion, so the bars feel
    // charged rather than flat.
    charge: sineCharge(0.82, 0.18, FRAMES),
    width: ART_COLUMN_WIDTH,
  }),
};
