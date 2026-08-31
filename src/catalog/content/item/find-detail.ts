import { z } from 'zod';

import path from 'node:path';
import fs from 'node:fs';

import { readJsonFile } from '#core/json.js';

import {
  AGENTS_DIR_NAME,
  GUIDELINES_DIR_NAME,
  PACKS_DIR_NAME,
  SKILLS_DIR_NAME,
} from '../schema.js';
import {
  AGENT_MANIFEST_FILENAME,
  AgentManifestSchema,
  GUIDELINE_MANIFEST_FILENAME,
  GuidelineManifestSchema,
  SKILL_MANIFEST_FILENAME,
  SkillManifestSchema,
} from './schema.js';
import type { Agent, Guideline, Skill } from './model.js';

function isWithinSkill(skillDir: string, relPath: string): boolean {
  const abs = path.resolve(skillDir, relPath);
  const rel = path.relative(skillDir, abs);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function findSkill(catalogDir: string, packName: string, skillName: string): Skill | null {
  const skillDir = path.join(catalogDir, PACKS_DIR_NAME, packName, SKILLS_DIR_NAME, skillName);

  const manifestPath = path.join(skillDir, SKILL_MANIFEST_FILENAME);
  const manifestExists = fs.existsSync(manifestPath);
  if (!manifestExists) return null;

  const raw = readJsonFile(manifestPath);
  const parsed = SkillManifestSchema.safeParse(raw);
  if (parsed.error) {
    throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
  }

  const manifest = parsed.data;

  const instructionsPath = path.join(skillDir, manifest.instructions);
  const instructions = fs.readFileSync(instructionsPath, 'utf-8');
  const sourceDir = skillDir;
  const assets = manifest.assets;

  for (const asset of assets) {
    const withinSkill = isWithinSkill(skillDir, asset);
    if (!withinSkill) {
      throw new Error(`${manifestPath}: asset '${asset}' escapes the skill directory.`);
    }
    const assetPath = path.join(skillDir, asset);
    const assetExists = fs.existsSync(assetPath);
    if (!assetExists) {
      throw new Error(`${manifestPath}: asset '${asset}' does not exist.`);
    }
  }

  return {
    name: manifest.name,
    description: manifest.description,
    toolConfig: manifest.toolConfig,
    instructions,
    instructionsPath,
    sourceDir,
    assets,
  };
}

export function findAgent(catalogDir: string, packName: string, agentName: string): Agent | null {
  const agentDir = path.join(catalogDir, PACKS_DIR_NAME, packName, AGENTS_DIR_NAME, agentName);

  const manifestPath = path.join(agentDir, AGENT_MANIFEST_FILENAME);
  const manifestExists = fs.existsSync(manifestPath);
  if (!manifestExists) return null;

  const raw = readJsonFile(manifestPath);
  const parsed = AgentManifestSchema.safeParse(raw);
  if (parsed.error) {
    throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
  }

  const manifest = parsed.data;

  const instructionsPath = path.join(agentDir, manifest.instructions);
  const instructions = fs.readFileSync(instructionsPath, 'utf-8');

  return {
    name: manifest.name,
    description: manifest.description,
    toolConfig: manifest.toolConfig,
    instructions,
    instructionsPath,
  };
}

export function findGuideline(
  catalogDir: string,
  packName: string,
  guidelineName: string,
): Guideline | null {
  const guidelineDir = path.join(
    catalogDir,
    PACKS_DIR_NAME,
    packName,
    GUIDELINES_DIR_NAME,
    guidelineName,
  );

  const manifestPath = path.join(guidelineDir, GUIDELINE_MANIFEST_FILENAME);
  const manifestExists = fs.existsSync(manifestPath);
  if (!manifestExists) return null;

  const raw = readJsonFile(manifestPath);
  const parsed = GuidelineManifestSchema.safeParse(raw);
  if (parsed.error) {
    throw new Error(`${manifestPath} has an invalid format:\n${z.prettifyError(parsed.error)}`);
  }

  const manifest = parsed.data;

  const bodyPath = path.join(guidelineDir, manifest.body);
  const body = fs.readFileSync(bodyPath, 'utf-8');

  return {
    name: manifest.name,
    description: manifest.description,
    recommended: manifest.recommended,
    body,
    bodyPath,
  };
}
