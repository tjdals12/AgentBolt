import path from 'node:path';

import type { GuidelineSelection } from '#catalog/config/schema.js';

import { DEFAULT_GUIDELINE_USAGE } from '../reference.js';
import { Adapter } from './adapter.js';
import { type RenderedAgent, type RenderedGuideline, type RenderedSkill } from '../model.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

export class ClaudeAdapter extends Adapter {
  private readonly agentsDir: string = '.claude/agents';
  private readonly rulesDir: string = '.claude/rules';

  constructor() {
    super({ id: 'claude', skillsDir: '.claude/skills', managedBlockFile: 'CLAUDE.md' });
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
    const { name: guidelineName, description, body, usage } = guideline;

    if (guidelineSelection.load === 'reference') {
      const guidelineUsage = guidelineSelection.usage ?? usage;
      const installName = this.buildInstallName(sourceAlias, packName, guidelineName);
      const filePath = path.join(guidelineSelection.path, `${installName}.md`);
      const linkPath = filePath;
      const linkPathSegments = linkPath.split(path.sep);
      const encodedLinkPathSegments = linkPathSegments.map((segment) =>
        encodeURIComponent(segment),
      );
      const link = encodedLinkPathSegments.join('/');

      return {
        kind: 'reference-file',
        sourceAlias,
        packName,
        guidelineName,
        usage: guidelineUsage,
        filePath,
        content: body,
        reference: `- [${guidelineName}](${link}): ${guidelineUsage ?? DEFAULT_GUIDELINE_USAGE}`,
      };
    }

    if (guidelineSelection.load === 'always') {
      const sourceTag = `<!-- bolt: ${sourceAlias}/${packName}/${guidelineName} - ${description} -->`;

      return {
        kind: 'block-fragment',
        sourceAlias,
        packName,
        guidelineName,
        usage,
        fragment: `${sourceTag}\n\n${body}`,
      };
    }

    const installName = this.buildInstallName(sourceAlias, packName, guidelineName);

    const data: Record<string, unknown> = { description, paths: guidelineSelection.glob };
    const frontmatter = this.formatFrontmatter(data);

    const filePath = path.join(this.rulesDir, `${installName}.md`);
    const content = `---\n${frontmatter}\n---\n\n${body}\n`;

    return {
      kind: 'rule-file',
      sourceAlias,
      packName,
      guidelineName,
      usage,
      filePath,
      content,
    };
  }
}
