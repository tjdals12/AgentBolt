import path from 'node:path';

import type { GuidelineSelection } from '#catalog/config/schema.js';

import { Adapter } from './adapter.js';
import { type RenderedAgent, type RenderedGuideline, type RenderedSkill } from '../model.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

export class OpenCodeAdapter extends Adapter {
  private readonly agentsDir: string = '.opencode/agents';

  constructor() {
    super({ id: 'opencode', skillsDir: '.opencode/skills', managedBlockFile: 'AGENTS.md' });
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
    const vendorConfig = this.selectVendorConfig(toolConfig);
    const frontmatter = this.formatFrontmatter({ mode: 'subagent', ...vendorConfig, description });

    const filePath = path.join(this.agentsDir, `${installName}.md`);
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

    const sourceTag = `<!-- bolt: ${sourceAlias}/${packName}/${guidelineName} - ${description} -->`;

    const lines = [sourceTag, ''];
    if (guidelineSelection.load === 'conditional') {
      const globs = guidelineSelection.glob.map((value) => `\`${value}\``).join(', ');
      lines.push(
        `> **The guideline below applies only when working with files matching ${globs}.**`,
      );
      lines.push('');
    }
    lines.push(body);

    const fragment = lines.join('\n');

    return {
      kind: 'block-fragment',
      sourceAlias,
      packName,
      guidelineName,
      fragment,
    };
  }
}
