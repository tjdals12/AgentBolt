import chalk, { type ChalkInstance } from 'chalk';

import type { PaintArt, RGB } from './types.js';

export function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function mixRgb(from: RGB, to: RGB, t: number): RGB {
  return [mix(from[0], to[0], t), mix(from[1], to[1], t), mix(from[2], to[2], t)];
}

// Scales each channel by `charge` and clamps to 255, so charges above 1 drive
// the color toward white.
function shade(rgb: RGB, charge: number): ChalkInstance {
  const channels = rgb.map((c) => Math.min(255, Math.round(c * charge)));
  const hex = channels.map((c) => c.toString(16).padStart(2, '0')).join('');
  return chalk.hex(`#${hex}`);
}

/** Right-pads `text` to `width` columns (code-unit length). */
export function padTo(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - text.length));
}

/**
 * Display width counting emoji / wide code points as two columns, so logos
 * containing characters like ⚡ stay aligned.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const codePoint = ch.codePointAt(0) ?? 0;
    const isWide = codePoint === 0x26a1 || (codePoint >= 0x1f300 && codePoint <= 0x1faff);
    width += isWide ? 2 : 1;
  }
  return width;
}

/** Right-pads `text` to `width` columns by display width (wide-char aware). */
export function padToDisplay(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)));
}

/** Per-frame brightness scalar, fed to the gradient painters. */
export type Charge = (frameIndex: number) => number;

/** A charge that breathes on a sine curve once per `frameCount`-frame loop. */
export function sineCharge(base: number, amplitude: number, frameCount: number): Charge {
  return (frameIndex) => base + amplitude * Math.sin((2 * Math.PI * frameIndex) / frameCount);
}

/** A charge read from a fixed per-frame schedule (defaults to full when off-end). */
export function scheduledCharge(values: readonly number[]): Charge {
  return (frameIndex) => values[frameIndex] ?? 1;
}

/**
 * Colors each art line by its row along a top→foot gradient, scaled by the
 * per-frame charge. Used by the bolt, wordmark, and wave variants.
 */
export function verticalGradient(opts: {
  top: RGB;
  foot: RGB;
  charge: Charge;
  width: number;
  wide?: boolean;
}): PaintArt {
  const pad = opts.wide ? padToDisplay : padTo;
  return (frameLines, frameIndex) => {
    const charge = opts.charge(frameIndex);
    const height = frameLines.length;
    return frameLines.map((line, row) => {
      const t = height <= 1 ? 0 : Math.min(1, row / (height - 1));
      return shade(mixRgb(opts.top, opts.foot, t), charge)(pad(line, opts.width));
    });
  };
}

/**
 * Colors each art line column-by-column along a left→right gradient, scaled by
 * the per-frame charge. Used by the tide variant, where the gradient lights up
 * the surging waterline.
 */
export function horizontalGradient(opts: {
  left: RGB;
  right: RGB;
  charge: Charge;
  width: number;
}): PaintArt {
  return (frameLines, frameIndex) => {
    const charge = opts.charge(frameIndex);
    return frameLines.map((line) => {
      let painted = '';
      for (let column = 0; column < line.length; column++) {
        const t = line.length <= 1 ? 0 : Math.min(1, column / (line.length - 1));
        painted += shade(mixRgb(opts.left, opts.right, t), charge)(line[column]!);
      }
      return painted + ' '.repeat(Math.max(0, opts.width - line.length));
    });
  };
}

/**
 * Colors a whole frame with a single chalk style picked from a per-frame ramp.
 * Used by the fan-out variant, whose box-drawing logo reads as one color that
 * brightens as it builds.
 */
export function brightnessRamp(opts: {
  ramp: readonly ChalkInstance[];
  fallback: ChalkInstance;
  width: number;
  wide?: boolean;
}): PaintArt {
  const pad = opts.wide ? padToDisplay : padTo;
  return (frameLines, frameIndex) => {
    const color = opts.ramp[frameIndex] ?? opts.fallback;
    return frameLines.map((line) => color(pad(line, opts.width)));
  };
}
