import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

import type { Source } from '#catalog/source/schema.js';

type GitSource = Extract<Source, { type: 'git' }>;

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._@-]/g, '-');
}

function isGitMissing(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return 'code' in error && error.code === 'ENOENT';
}

function getErrorDetail(error: unknown): string {
  const fallback = 'unknown error';
  if (typeof error !== 'object' || error === null || !('stderr' in error)) return fallback;

  const stderr = error.stderr;
  const text = Buffer.isBuffer(stderr)
    ? stderr.toString('utf-8').trim()
    : typeof stderr === 'string'
      ? stderr.trim()
      : '';
  if (!text) return fallback;

  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const detail = lines.find((line) => line.includes('fatal:')) ?? lines.at(-1) ?? text;
  return detail.trim();
}

export function resolveGitSource(alias: string, source: GitSource): string {
  const { url, ref, subdir } = source;

  const dirPath = path.join(
    os.tmpdir(),
    'agent-bolt-git',
    `${sanitize(alias)}@${sanitize(ref ?? 'HEAD')}`,
  );

  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });

  const args = ['clone', '--depth', '1', '--quiet'];
  if (ref) {
    args.push('--branch', ref);
  }
  args.push('--', url, dirPath);

  try {
    execFileSync('git', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    fs.rmSync(dirPath, { recursive: true, force: true });

    if (isGitMissing(e)) {
      throw new Error(
        `source '${alias}': git command not found. Install git, or use a local source (type: local)`,
        { cause: e },
      );
    }

    const errorDetail = getErrorDetail(e);
    throw new Error(
      `source '${alias}': git clone failed (url: ${url}${ref ? `, ref: ${ref}` : ''}).\n  ${errorDetail}`,
      { cause: e },
    );
  }

  if (!subdir) return dirPath;

  const subdirPath = path.resolve(dirPath, subdir);

  const relativePath = path.relative(dirPath, subdirPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    throw new Error(`source '${alias}': subdir escapes the catalog root: ${subdir}`);
  }

  const subdirExists = fs.existsSync(subdirPath);
  if (!subdirExists) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    throw new Error(
      `source '${alias}': subdir not found: ${subdir} (check the path inside the repo)`,
    );
  }

  return subdirPath;
}
