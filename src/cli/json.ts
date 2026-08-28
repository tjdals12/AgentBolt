export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printJsonError(e: unknown): void {
  const message = e instanceof Error ? e.message : String(e);
  printJson({ error: { message } });
}
