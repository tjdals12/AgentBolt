import path from 'node:path';

import {
  AGENTS_DIR_NAME,
  GUIDELINES_DIR_NAME,
  PACKS_DIR_NAME,
  SKILLS_DIR_NAME,
} from '../schema.js';
import {
  AGENT_MANIFEST_FILENAME,
  GUIDELINE_MANIFEST_FILENAME,
  SKILL_MANIFEST_FILENAME,
} from './schema.js';
import type { Agent, Guideline, Skill } from './model.js';
import { findSkill, findAgent, findGuideline } from './find-detail.js';

export function parseSkill(catalogDir: string, packName: string, skillName: string): Skill {
  const skill = findSkill(catalogDir, packName, skillName);

  if (!skill) {
    const skillDir = path.join(catalogDir, PACKS_DIR_NAME, packName, SKILLS_DIR_NAME, skillName);
    const manifestPath = path.join(skillDir, SKILL_MANIFEST_FILENAME);

    throw new Error(`skill '${skillName}' not found in pack '${packName}' (${manifestPath})`);
  }

  return skill;
}

export function parseAgent(catalogDir: string, packName: string, agentName: string): Agent {
  const agent = findAgent(catalogDir, packName, agentName);

  if (!agent) {
    const agentDir = path.join(catalogDir, PACKS_DIR_NAME, packName, AGENTS_DIR_NAME, agentName);
    const manifestPath = path.join(agentDir, AGENT_MANIFEST_FILENAME);

    throw new Error(`agent '${agentName}' not found in pack '${packName}' (${manifestPath})`);
  }

  return agent;
}

export function parseGuideline(
  catalogDir: string,
  packName: string,
  guidelineName: string,
): Guideline {
  const guideline = findGuideline(catalogDir, packName, guidelineName);

  if (!guideline) {
    const guidelineDir = path.join(
      catalogDir,
      PACKS_DIR_NAME,
      packName,
      GUIDELINES_DIR_NAME,
      guidelineName,
    );
    const manifestPath = path.join(guidelineDir, GUIDELINE_MANIFEST_FILENAME);

    throw new Error(
      `guideline '${guidelineName}' not found in pack '${packName}' (${manifestPath})`,
    );
  }

  return guideline;
}
