import { z } from 'zod';

import path from 'node:path';
import fs from 'node:fs';

import { readJsonFile } from '#core/json.js';

import { PACK_MANIFEST_FILENAME, PackManifestSchema } from './schema.js';
import type { PackSummary, PackDetail } from './model.js';
import { SKILLS_DIR_NAME, AGENTS_DIR_NAME, GUIDELINES_DIR_NAME } from '../schema.js';
import { SKILL_MANIFEST_FILENAME, AGENT_MANIFEST_FILENAME } from '../item/schema.js';
import { parseItems, countItems, parseGuidelineItems } from '../item/parse-summary.js';

export function listPackDirs(dir: string): string[] {
  const dirExists = fs.existsSync(dir);
  if (!dirExists) return [];

  const subDirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .sort();

  return subDirs;
}

export function parsePackSummary(packDir: string): PackSummary {
  const manifestPath = path.join(packDir, PACK_MANIFEST_FILENAME);

  const raw = readJsonFile(manifestPath);

  const parsed = PackManifestSchema.safeParse(raw);
  if (parsed.error) {
    throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
  }

  const manifest = parsed.data;

  const skillsDir = path.join(packDir, SKILLS_DIR_NAME);
  const skillsCount = countItems(skillsDir);

  const agentsDir = path.join(packDir, AGENTS_DIR_NAME);
  const agentsCount = countItems(agentsDir);

  const guidelinesDir = path.join(packDir, GUIDELINES_DIR_NAME);
  const guidelinesCount = countItems(guidelinesDir);

  return {
    name: manifest.name,
    description: manifest.description,
    counts: {
      skills: skillsCount,
      agents: agentsCount,
      guidelines: guidelinesCount,
    },
  };
}

export function parsePackDetail(packDir: string): PackDetail {
  const manifestPath = path.join(packDir, PACK_MANIFEST_FILENAME);

  const raw = readJsonFile(manifestPath);

  const parsed = PackManifestSchema.safeParse(raw);
  if (parsed.error) {
    throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
  }

  const manifest = parsed.data;

  const skillsDir = path.join(packDir, SKILLS_DIR_NAME);
  const skills = parseItems(skillsDir, SKILL_MANIFEST_FILENAME);

  const agentsDir = path.join(packDir, AGENTS_DIR_NAME);
  const agents = parseItems(agentsDir, AGENT_MANIFEST_FILENAME);

  const guidelinesDir = path.join(packDir, GUIDELINES_DIR_NAME);
  const guidelines = parseGuidelineItems(guidelinesDir);

  return {
    name: manifest.name,
    description: manifest.description,
    items: {
      skills,
      agents,
      guidelines,
    },
  };
}
