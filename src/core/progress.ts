import chalk from 'chalk';

export abstract class ProgressReporter {
  abstract start(label: string): void;
  abstract succeed(label: string): void;
  abstract fail(reason: string): void;
  abstract stop(): void;

  static create(): ProgressReporter {
    return process.stdout.isTTY ? new LineReporter() : new NoopReporter();
  }
}

class NoopReporter extends ProgressReporter {
  override start(_label: string): void {}
  override succeed(_label?: string): void {}
  override fail(_reason?: string): void {}
  override stop(): void {}
}

class LineReporter extends ProgressReporter {
  private _active = false;

  private clearLine() {
    if (this._active) {
      process.stdout.write('\r\x1b[K');
    }
  }

  override start(label: string): void {
    this.clearLine();
    process.stdout.write(`  ${chalk.dim(`${label}…`)}`);
    this._active = true;
  }

  override succeed(label: string): void {
    this.clearLine();
    process.stdout.write(`${chalk.green('✔')} ${label}\n`);
    this._active = false;
  }

  override fail(reason: string): void {
    this.clearLine();
    const [first, ...rest] = reason.split('\n');
    process.stdout.write(`${chalk.yellow('⚠')} ${first}\n`);
    for (const line of rest) {
      process.stdout.write(`${line}\n`);
    }
    this._active = false;
  }

  override stop(): void {
    this.clearLine();
    this._active = false;
  }
}
