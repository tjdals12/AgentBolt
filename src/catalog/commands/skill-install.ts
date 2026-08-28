import { buildCatalogConfigPath } from '#core/paths.js';
import { loadConfig } from '#catalog/config/load.js';
import { installBundledSkill, type ToolSkillInstall } from '#catalog/skill/install.js';

export type SkillInstallResult = {
  skill: string;
  version: string;
  tools: ToolSkillInstall[];
};

export class SkillInstallCommand {
  execute(projectPath: string, version: string): SkillInstallResult {
    const configPath = buildCatalogConfigPath(projectPath);
    const config = loadConfig(configPath);

    const toolIds = config.tools;
    const name = 'agent-bolt';
    const tools = installBundledSkill({
      projectPath,
      toolIds,
      name,
      version,
    });

    return { skill: name, version, tools };
  }

  toJson(result: SkillInstallResult) {
    return result;
  }
}
