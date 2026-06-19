/**
 * One intro variant: the animated logo shown beside the welcome text at the
 * start of interactive `init`. Each variant lives in its own file under
 * `variants/`, exposing this shape so the engine can drive any of them and the
 * registry can swap between them. See `registry.ts` for selection.
 */
export interface Intro {
  /** Stable identifier, also the registry key and `AGENT_BOLT_INTRO` value. */
  readonly id: string;
  readonly label: string;
  /** Below this terminal width the animation is skipped for a static frame. */
  readonly minWidth: number;
  /** Width reserved for the logo column; art lines are padded to it. */
  readonly artColumnWidth: number;
  /** Milliseconds between animation frames. */
  readonly interval: number;
  /** Each frame is an array of art lines, one per row. */
  readonly frames: readonly string[][];
  /** Frame used as the static fallback when the terminal can't animate. */
  readonly peakFrameIndex: number;
  /** Wordmark line for the welcome text; falls back to the shared default. */
  readonly title?: string;
  /**
   * Colors one frame's art lines and pads each to `artColumnWidth`. The engine
   * places the returned lines beside the welcome text. Built from a `paint.ts`
   * helper (vertical/horizontal gradient or brightness ramp).
   */
  readonly paintArt: PaintArt;
}

export type PaintArt = (frameLines: readonly string[], frameIndex: number) => string[];

/** An RGB triple, channels 0–255. */
export type RGB = readonly [number, number, number];
