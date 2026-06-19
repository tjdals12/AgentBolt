import path from 'node:path';
import toml from 'smol-toml';

import type { GuidelineSelection } from '#catalog/config/schema.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

import type { RenderedSkill, RenderedAgent, RenderedGuideline } from '../model.js';
import { Adapter } from './adapter.js';

export class CodexAdapter extends Adapter {
  private readonly skillsDir: string = '.codex/skills';
  private readonly agentsDir: string = '.codex/agents';

  constructor() {
    super({ id: 'codex', managedBlockFile: 'AGENTS.md' });
  }

  override renderSkill(sourceAlias: string, packName: string, skill: Skill): RenderedSkill {
    const { name: skillName, description, toolConfig, instructions, sourceDir, assets } = skill;
    const installName = this.buildInstallName(sourceAlias, packName, skillName);
    const frontmatter = this.buildItemFrontmatter({ name: installName, description, toolConfig });

    const dir = path.join(this.skillsDir, installName);
    const entryFileName = 'SKILL.md';
    const entryContent = `---\n${frontmatter}\n---\n\n${instructions}\n`;

    return {
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

    const placeholder = '__BOLT_DEVELOPER_INSTRUCTIONS';

    const serialized = toml.stringify({
      name: installName,
      description,
      developer_instructions: placeholder,
      ...vendorConfig,
    });

    const escaped = instructions.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
    const multiline = `"""\n${escaped}\n"""`;
    const content = `${serialized.replace(`"${placeholder}"`, multiline).trimEnd()}\n`;

    const filePath = path.join(this.agentsDir, `${installName}.toml`);

    return {
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
      packName,
      guidelineName,
      fragment,
    };
  }
}
