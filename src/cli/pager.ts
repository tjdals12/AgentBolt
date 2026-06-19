import { spawn } from 'node:child_process';
import { format } from 'node:util';

const DEFAULT_ROWS = 24;

export function withPager(render: () => void, usePager: boolean): void {
  if (!usePager || !process.stdout.isTTY) {
    render();
    return;
  }

  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(format(...args));
  };
  try {
    render();
  } finally {
    console.log = original;
  }

  const output = `${lines.join('\n')}\n`;

  const rows = process.stdout.rows ?? DEFAULT_ROWS;
  if (lines.length < rows) {
    process.stdout.write(output);
    return;
  }

  const pagerCommand = process.env.PAGER;
  const child = pagerCommand
    ? spawn(pagerCommand, { shell: true, stdio: ['pipe', 'inherit', 'inherit'] })
    : spawn('less', ['-R', '-F', '-X'], { stdio: ['pipe', 'inherit', 'inherit'] });

  child.on('error', () => process.stdout.write(output));
  child.stdin.on('error', () => {});
  child.stdin.write(output);
  child.stdin.end();
}
