import type { Intro } from './types.js';
import { tide } from './variants/tide.js';
import { bolt } from './variants/bolt.js';
import { fanout } from './variants/fanout.js';
import { wordmark } from './variants/wordmark.js';
import { wordmarkWave } from './variants/wordmark-wave.js';

/**
 * Every intro variant, keyed by id. To drop one, delete its `variants/<id>.ts`
 * file and remove its line here.
 */
export const INTROS = {
  tide,
  bolt,
  fanout,
  wordmark,
  'wordmark-wave': wordmarkWave,
} as const satisfies Record<string, Intro>;

export type IntroId = keyof typeof INTROS;

/** The intro that ships. Change this one line to switch the default. */
export const DEFAULT_INTRO_ID: IntroId = 'bolt';

function isIntroId(value: string | undefined): value is IntroId {
  return value !== undefined && value in INTROS;
}

/**
 * Resolves which intro to show. `AGENT_BOLT_INTRO=<id>` overrides the default at
 * runtime — handy for previewing each variant without a code change.
 */
export function resolveIntro(): Intro {
  const requested = process.env.AGENT_BOLT_INTRO;
  const id = isIntroId(requested) ? requested : DEFAULT_INTRO_ID;
  return INTROS[id];
}
