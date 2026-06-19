import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import fs from 'node:fs';

import { ConfigSchema, type Config } from './schema.js';

export function loadConfig(path: string): Config {
  const existsConfig = fs.existsSync(path);
  if (!existsConfig) {
    throw new Error(`Config not found at ${path}. Run 'agent-bolt init' first.`);
  }

  const raw = fs.readFileSync(path, 'utf-8');
  const parsed = parseYaml(raw) as unknown;

  const result = ConfigSchema.safeParse(parsed);
  if (result.error) {
    throw new Error(`Invalid config at ${path}.\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
