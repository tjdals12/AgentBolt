import path from 'node:path';

import type { GuidelineSelection } from '#catalog/config/schema.js';

import { Adapter } from './adapter.js';
import { type RenderedAgent, type RenderedGuideline, type RenderedSkill } from '../model.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

export class CopilotAdapter extends Adapter {
  private readonly agentsDir: string = '.github/agents';
  private readonly instructionsDir: string = '.github/instructions';

  constructor() {
    super({ id: 'copilot', skillsDir: '.github/skills' });
  }

  override renderSkill(sourceAlias: string, packName: string, skill: Skill): RenderedSkill {
    const { name: skillName, description, toolConfig, instructions, sourceDir, assets } = skill;
    const installName = this.buildInstallName(sourceAlias, packName, skillName);
    const frontmatter = this.buildItemFrontmatter({ name: installName, description, toolConfig });

    const dir = path.join(this.skillsDir, installName);
    const entryFileName = 'SKILL.md';
    const entryContent = `---\n${frontmatter}\n---\n\n${instructions}\n`;

    return {
      sourceAlias,
      packName,
      skillName,
      dir,
      entryFileName,
      entryContent,
      sourceDir,
      assets,
    };
  }

  override renderAgent(sourceAlias: string, packName: string, agent: Agent): RenderedAgent {
    const { name: agentName, description, toolConfig, instructions } = agent;
    const installName = this.buildInstallName(sourceAlias, packName, agentName);
    const frontmatter = this.buildItemFrontmatter({ name: installName, description, toolConfig });

    const filePath = path.join(this.agentsDir, `${installName}.agent.md`);
    const content = `---\n${frontmatter}\n---\n\n${instructions}\n`;

    return {
      sourceAlias,
      packName,
      agentName,
      filePath,
      content,
    };
  }

  override renderGuideline(
    sourceAlias: string,
    packName: string,
    guideline: Guideline,
    guidelineSelection: GuidelineSelection,
  ): RenderedGuideline {
    const { name: guidelineName, description, body } = guideline;
    const installName = this.buildInstallName(sourceAlias, packName, guidelineName);

    const applyTo =
      guidelineSelection.load === 'conditional' ? guidelineSelection.glob.join(',') : '**';
    const frontmatter = this.formatFrontmatter({ description, applyTo });

    const filePath = path.join(this.instructionsDir, `${installName}.instructions.md`);
    const content = `---\n${frontmatter}\n---\n\n${body}\n`;

    return {
      kind: 'rule-file',
      sourceAlias,
      packName,
      guidelineName,
      filePath,
      content,
    };
  }
}
