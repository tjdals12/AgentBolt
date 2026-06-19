import type { Intro } from '../types.js';
import { scheduledCharge, verticalGradient } from '../paint.js';

// An enlarged take on AgentBolt's ▌ banner motif: a bold vertical bar that
// charges from the top down, then holds and pulses. Full blocks render crisply
// wherever the banner's ▌ already does. A vertical blue→violet gradient gives
// it an energized, electric feel.
const ROWS = 12;
const BAR = '██';

const ART_WIDTH = BAR.length;
const ART_COLUMN_WIDTH = 6;
const blank = ' '.repeat(ART_WIDTH);

const blanks = (count: number): string[] => Array.from({ length: count }, () => blank);
const bars = (count: number): string[] => Array.from({ length: count }, () => BAR);
const charge = (filled: number): string[] => [...bars(filled), ...blanks(ROWS - filled)];

const peak = charge(ROWS);

// The bar charges top-to-bottom (frames 0–4), then the full bar holds and
// pulses (frames 4–9) before the loop restarts. Values above 1 push the
// gradient toward white (channels clamp at 255).
const CHARGE = [0.45, 0.6, 0.78, 0.92, 1, 1, 1.35, 0.5, 1.35, 0.55];

const frames = [charge(0), charge(3), charge(6), charge(9), peak, peak, peak, peak, peak, peak];

export const wordmark: Intro = {
  id: 'wordmark',
  label: 'Wordmark bar — the ▌ banner motif charges and pulses (blue→violet)',
  minWidth: 58,
  artColumnWidth: ART_COLUMN_WIDTH,
  interval: 95,
  frames,
  peakFrameIndex: 4,
  paintArt: verticalGradient({
    top: [56, 189, 248],
    foot: [139, 92, 246],
    charge: scheduledCharge(CHARGE),
    width: ART_COLUMN_WIDTH,
  }),
};
