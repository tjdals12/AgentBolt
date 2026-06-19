import { z } from 'zod';

import path from 'node:path';
import fs from 'node:fs';

import { readJsonFile } from '#core/json.js';

import type { GuidelineItem, Item } from './model.js';
import {
  GUIDELINE_MANIFEST_FILENAME,
  GuidelineManifestSchema,
  ItemManifestSchema,
} from './schema.js';

export function listItemDirs(dir: string): string[] {
  const dirExists = fs.existsSync(dir);
  if (!dirExists) return [];

  const subdirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .sort();

  return subdirs;
}

export function countItems(itemDir: string): number {
  const dirExists = fs.existsSync(itemDir);
  if (!dirExists) return 0;

  const count = fs
    .readdirSync(itemDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).length;

  return count;
}

export function parseItems(typeDir: string, manifestFileName: string): Item[] {
  const itemDirs = listItemDirs(typeDir);

  const items = itemDirs.map<Item>((itemDir) => {
    const manifestPath = path.join(itemDir, manifestFileName);

    const raw = readJsonFile(manifestPath);

    const parsed = ItemManifestSchema.safeParse(raw);
    if (parsed.error) {
      throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
    }

    const manifest = parsed.data;

    return { name: manifest.name, description: manifest.description };
  });

  return items;
}

export function parseGuidelineItems(typeDir: string): GuidelineItem[] {
  const itemsDir = listItemDirs(typeDir);

  const items = itemsDir.map<GuidelineItem>((itemDir) => {
    const manifestPath = path.join(itemDir, GUIDELINE_MANIFEST_FILENAME);

    const raw = readJsonFile(manifestPath);

    const parsed = GuidelineManifestSchema.safeParse(raw);
    if (parsed.error) {
      throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
    }

    const manifest = parsed.data;

    return {
      name: manifest.name,
      description: manifest.description,
      recommended: manifest.recommended,
    };
  });

  return items;
}
