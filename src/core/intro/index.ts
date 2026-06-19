import { runIntro } from './engine.js';
import { resolveIntro } from './registry.js';

/**
 * Shows the welcome screen for the interactive `init` flow. Picks the active
 * intro variant (see `registry.ts`) and runs it.
 */
export async function showWelcomeScreen(): Promise<void> {
  await runIntro(resolveIntro());
}
