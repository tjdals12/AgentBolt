import type { Intro } from './types.js';
import { buildWelcomeLines } from './text.js';
import { padTo } from './paint.js';

const MARGIN = '  ';

function canAnimate(intro: Intro): boolean {
  if (!process.stdout.isTTY) return false;
  if (process.env.NO_COLOR) return false;
  const columns = process.stdout.columns ?? 80;
  if (columns < intro.minWidth) return false;
  return true;
}

/** Renders one frame: the colored logo column beside the welcome text. */
function composeFrame(intro: Intro, textLines: string[], frameIndex: number): string {
  const artLines = intro.paintArt(intro.frames[frameIndex] ?? [], frameIndex);
  const blankArt = padTo('', intro.artColumnWidth);
  const maxLines = Math.max(artLines.length, textLines.length);

  const lines: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    const artLine = artLines[i] ?? blankArt;
    const textLine = textLines[i] ?? '';
    // \x1b[2K clears the line first so a previous frame leaves no residue.
    lines.push(`\x1b[2K${MARGIN}${artLine}${textLine}`);
  }

  return lines.join('\n');
}

/** Waits for the user to press Enter. Resolves immediately outside a TTY. */
function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const { stdin } = process;

    if (!stdin.isTTY) {
      resolve();
      return;
    }

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    const onData = (data: Buffer): void => {
      const char = data.toString();
      if (char === '\r' || char === '\n' || char === '\u0003') {
        stdin.removeListener('data', onData);
        stdin.setRawMode(wasRaw);
        stdin.pause();
        // Ctrl+C: exit cleanly instead of falling through to the prompt.
        if (char === '\u0003') {
          process.stdout.write('\n');
          process.exit(0);
        }
        resolve();
      }
    };

    stdin.on('data', onData);
  });
}

/** Erases `lineCount` rendered lines above the cursor, leaving a clean view. */
function clearRenderedArea(lineCount: number): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`\x1b[${lineCount}A`);
  for (let i = 0; i < lineCount; i++) {
    process.stdout.write('\x1b[2K\n');
  }
  process.stdout.write(`\x1b[${lineCount}A`);
}

/**
 * Runs an intro for the interactive `init` flow: animates the logo beside the
 * welcome text, waits for Enter, then erases what it drew so the next prompt
 * starts on a clean view. Degrades to a static frame when the terminal can't
 * animate, and resolves at once outside a TTY.
 */
export async function runIntro(intro: Intro): Promise<void> {
  const textLines = buildWelcomeLines(intro.title);
  const artHeight = intro.frames[0]?.length ?? 0;
  const contentHeight = Math.max(artHeight, textLines.length);
  const totalHeight = contentHeight + 1; // one leading newline + the rendered block

  if (!canAnimate(intro)) {
    process.stdout.write('\n' + composeFrame(intro, textLines, intro.peakFrameIndex) + '\n');
    await waitForEnter();
    clearRenderedArea(totalHeight);
    return;
  }

  let frameIndex = 0;
  let isFirstRender = true;

  process.stdout.write('\n');

  const interval = setInterval(() => {
    if (!isFirstRender) {
      process.stdout.write(`\x1b[${contentHeight}A`);
    }
    isFirstRender = false;

    process.stdout.write(composeFrame(intro, textLines, frameIndex) + '\n');
    frameIndex = (frameIndex + 1) % intro.frames.length;
  }, intro.interval);

  await waitForEnter();

  clearInterval(interval);
  clearRenderedArea(totalHeight);
}
