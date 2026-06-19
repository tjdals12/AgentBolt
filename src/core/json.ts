import fs from 'node:fs';

export function readJsonFile(filePath: string): unknown {
  try {
    const file = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(file);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not read ${filePath}: ${message}`, { cause: e });
  }
}
