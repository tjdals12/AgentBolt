import { chalkStderr } from 'chalk';

export const ConsoleOutput = {
  error(message: string): void {
    const [first, ...lines] = message.split('\n');
    console.error(chalkStderr.red(`✗ ${first}`));
    for (const line of lines) {
      console.error(line);
    }
  },

  warn(message: string): void {
    const [first, ...lines] = message.split('\n');
    console.error(chalkStderr.yellow(`⚠ ${first}`));
    for (const line of lines) {
      console.error(line);
    }
  },
};
