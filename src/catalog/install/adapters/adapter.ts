import { stringify } from 'yaml';

import type { ToolConfig } from '#catalog/content/item/schema.js';
import type { GuidelineSelection } from '#catalog/config/schema.js';
import type { ToolId } from '#catalog/tool/model.js';

import type { RenderedSkill, RenderedAgent, RenderedGuideline } from '../model.js';
import type { Agent, Guideline, Skill } from '#catalog/content/item/model.js';

export abstract class Adapter {
  protected readonly _id: ToolId;
  get id() {
    return this._id;
  }

  protected readonly _skillsDir: string;
  get skillsDir() {
    return this._skillsDir;
  }

  protected readonly _managedBlockFile?: string;
  get managedBlockFile() {
    return this._managedBlockFile;
  }

  constructor(args: { id: ToolId; skillsDir: string; managedBlockFile?: string }) {
    this._id = args.id;
    this._skillsDir = args.skillsDir;
    this._managedBlockFile = args.managedBlockFile;
  }

  protected buildInstallName(sourceAlias: string, packName: string, itemName: string): string {
    return `bolt-${sourceAlias}-${packName}-${itemName}`;
  }

  protected selectVendorConfig(toolConfig: ToolConfig | undefined): Record<string, unknown> {
    return toolConfig?.[this._id] ?? {};
  }

  protected formatFrontmatter(data: Record<string, unknown>): string {
    return stringify(data, { lineWidth: 0 }).trimEnd();
  }

  protected buildItemFrontmatter(data: {
    name: string;
    description: string;
    toolConfig: ToolConfig | undefined;
  }): string {
    const { name, description, toolConfig } = data;
    const vendorConfig = this.selectVendorConfig(toolConfig);
    return this.formatFrontmatter({ ...vendorConfig, name, description });
  }

  abstract renderSkill(sourceAlias: string, packName: string, skill: Skill): RenderedSkill;
  abstract renderAgent(sourceAlias: string, packName: string, agent: Agent): RenderedAgent;
  abstract renderGuideline(
    sourceAlias: string,
    packName: string,
    guideline: Guideline,
    guidelineSelection: GuidelineSelection,
  ): RenderedGuideline;
}
