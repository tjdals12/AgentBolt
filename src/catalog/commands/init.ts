import { checkbox, select, input, Separator } from '@inquirer/prompts';
import { Document } from 'yaml';
import chalk from 'chalk';

import path from 'node:path';
import fs from 'node:fs';

import { buildCatalogConfigPath } from '#core/paths.js';
import { CONFIG_VERSION, type Config, type Packs } from '#catalog/config/schema.js';
import { SUPPORTED_SOURCE_TYPES, type Source } from '#catalog/source/schema.js';
import { SourceValidation } from '#catalog/source/validation.js';
import { renderConfigReference } from '#catalog/config/reference.js';
import { loadConfig } from '#catalog/config/load.js';
import { normalizeConfig } from '#catalog/config/normalize.js';
import { type ToolId } from '#catalog/tool/model.js';
import { isToolId, listTools } from '#catalog/tool/catalog.js';
import { showWelcomeScreen } from '#core/intro/index.js';
import { canPrompt } from '#core/tty.js';

export type InitResult = {
  configPath: string;
  tools: ToolId[];
  sources: Record<string, Source>;
  orphanedSourceAliases: string[];
};

export class InitCommand {
  private readonly _tools?: string;
  private readonly _sources: string[];
  private readonly _force: boolean;

  constructor(options: { tools?: string; source: string[]; force: boolean }) {
    this._tools = options.tools;
    this._sources = options.source;
    this._force = options.force;
  }

  async execute(projectPath: string): Promise<InitResult> {
    const configPath = buildCatalogConfigPath(projectPath);
    const interactive = this.resolveInteractive();

    let tools: ToolId[];
    let sources: Record<string, Source>;
    let packs: Packs;

    if (interactive) {
      await showWelcomeScreen();

      const existingConfig = fs.existsSync(configPath) ? loadConfig(configPath) : undefined;
      const detectedTools = this.detectInstalledTools(projectPath);
      const preselectedTools = this.resolvePreselectedTools(existingConfig);

      tools = await this.promptTools(preselectedTools, detectedTools);
      sources = await this.collectSources(existingConfig);
      packs = existingConfig?.packs ?? {};

      console.log();
    } else {
      this.assertCanCreateConfig(configPath);
      tools = this.resolveTools();
      sources = this.resolveSources();
      packs = {};
    }

    const builtConfig = this.buildConfig({ tools, sources, packs });
    const { config: normalizedConfig, orphanedSourceAliases } = normalizeConfig(builtConfig);
    this.writeConfig(configPath, normalizedConfig);

    return { configPath, tools, sources, orphanedSourceAliases };
  }

  private resolveInteractive(): boolean {
    const wantsInteractive = this._tools === undefined;
    if (wantsInteractive && !canPrompt()) {
      throw new Error(
        'The --tools option is required (or run init in an interactive terminal). e.g. --tools=codex,claude',
      );
    }
    return wantsInteractive;
  }

  private assertCanCreateConfig(configPath: string): void {
    const exists = fs.existsSync(configPath);
    if (exists && !this._force) {
      throw new Error(`Config already exists at ${configPath}. Use --force to overwrite.`);
    }
  }

  private resolveTools(): ToolId[] {
    const tools = (this._tools ?? '')
      .split(',')
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);

    if (tools.length === 0) {
      throw new Error('The --tools option is required. e.g. --tools=codex,claude');
    }

    const unknownTools = tools.filter((tool) => !isToolId(tool));
    if (unknownTools.length > 0) {
      const availableTools = listTools();
      const availableToolIds = availableTools.map((availableTool) => availableTool.id);
      throw new Error(
        `Unknown tool: ${unknownTools.join(', ')}. Available: ${availableToolIds.join(', ')}`,
      );
    }

    const validTools = tools.filter((tool) => isToolId(tool));

    return validTools;
  }

  private detectInstalledTools(projectPath: string): ToolId[] {
    const tools = listTools();
    return tools
      .filter((tool) => fs.existsSync(path.join(projectPath, tool.marker)))
      .map((tool) => tool.id);
  }

  private resolvePreselectedTools(existingConfig: Config | undefined): ToolId[] {
    return existingConfig?.tools ?? [];
  }

  private async promptTools(preselected: ToolId[], detected: ToolId[]): Promise<ToolId[]> {
    const message = 'Select the AI tools to set up';
    const tools = listTools();
    const choices = tools.map((tool) => {
      const name = detected.includes(tool.id)
        ? `${tool.displayName} ${chalk.dim('(detected)')}`
        : tool.displayName;
      const value = tool.id;
      const checked = preselected.includes(tool.id);
      return {
        name,
        value,
        checked,
      };
    });

    return checkbox({
      message,
      choices,
      validate: (items) => items.length > 0 || 'Select at least one tool',
    });
  }

  private buildSourceSeparators(sources: Record<string, Source>): Separator[] {
    const separators: Separator[] = [];

    const entries = Object.entries(sources);
    if (entries.length === 0) {
      separators.push(new Separator(chalk.dim('No sources yet.')));
    } else {
      separators.push(new Separator(chalk.dim('Current sources:')));

      entries.forEach(([alias, source]) => {
        const location = source.type === 'local' ? source.path : source.url;
        separators.push(
          new Separator(`  • ${alias} ${chalk.dim(`(${source.type} · ${location})`)}`),
        );
      });
    }

    return separators;
  }

  private async promptNewSource(
    takenAliases: string[],
  ): Promise<{ alias: string; source: Source } | null> {
    const type = await select({
      message: 'Source type',
      choices: [
        ...SUPPORTED_SOURCE_TYPES.map((value) => ({ value })),
        new Separator(),
        { name: '← Back', value: null },
      ],
    });

    if (type === null) return null;

    const alias = await input({
      message: 'Alias',
      validate: (value) =>
        SourceValidation.toValidate(SourceValidation.validateAlias(value, takenAliases)),
    });

    const location = await input({
      message: type === 'git' ? 'Git URL' : 'Local path',
      validate: (value) => SourceValidation.toValidate(SourceValidation.validateLocation(value)),
    });

    const source: Source =
      type === 'git' ? { type: 'git', url: location } : { type: 'local', path: location };

    return {
      alias,
      source,
    };
  }

  private async promptRemoveSource(sources: Record<string, Source>): Promise<string[]> {
    const choices: { name: string; value: string }[] = Object.entries(sources).map(
      ([alias, source]) => {
        const location = source.type === 'local' ? source.path : source.url;
        const name = `${alias} ${chalk.dim(`(${source.type} · ${location})`)}`;
        const value = alias;

        return {
          name,
          value,
        };
      },
    );

    return checkbox({
      message: 'Select sources to remove (leave empty to go back)',
      choices,
    });
  }

  private async collectSources(
    existingConfig: Config | undefined,
  ): Promise<Record<string, Source>> {
    const workingSources: Record<string, Source> = existingConfig
      ? { ...existingConfig.sources }
      : {};

    while (true) {
      const takenAliases = Object.keys(workingSources);
      const hasSources = takenAliases.length > 0;

      const actions: { name: string; value: 'add' | 'remove' | 'done' }[] = [
        { name: 'Add a source', value: 'add' },
      ];

      if (hasSources) {
        actions.push({ name: 'Remove a source', value: 'remove' });
        actions.push({ name: 'Done', value: 'done' });
      }

      const sourceSeparators = this.buildSourceSeparators(workingSources);

      const action = await select<'add' | 'remove' | 'done'>({
        message: 'Manage catalog sources',
        choices: [...sourceSeparators, new Separator(' '), ...actions],
      });

      if (action === 'done') return workingSources;

      if (action === 'add') {
        const result = await this.promptNewSource(takenAliases);
        if (result) {
          const { alias, source } = result;
          workingSources[alias] = source;
        }
      }

      if (action === 'remove') {
        const aliases = await this.promptRemoveSource(workingSources);
        aliases.forEach((alias) => delete workingSources[alias]);
      }
    }
  }

  private resolveSources(): Record<string, Source> {
    const inputSources = this._sources;

    if (inputSources.length === 0) {
      throw new Error('The --source option is required. e.g. --source dev=local:./catalog');
    }

    const sources: Record<string, Source> = {};

    for (const inputSource of inputSources) {
      const equalsIndex = inputSource.indexOf('=');
      const colonIndex = inputSource.indexOf(':', equalsIndex + 1);

      if (equalsIndex === -1 || colonIndex === -1) {
        throw new Error(
          `Invalid source '${inputSource}'. Source must be in the form <alias>=<type>:<location>.`,
        );
      }

      const alias = inputSource.slice(0, equalsIndex);
      const type = inputSource.slice(equalsIndex + 1, colonIndex);
      const location = inputSource.slice(colonIndex + 1);

      SourceValidation.assert(SourceValidation.validateAlias(alias, Object.keys(sources)));
      SourceValidation.assert(SourceValidation.validateType(type));
      SourceValidation.assert(SourceValidation.validateLocation(location));

      switch (type) {
        case 'local':
          sources[alias] = { type: 'local', path: location };
          break;
        case 'git':
          sources[alias] = { type: 'git', url: location };
          break;
      }
    }

    return sources;
  }

  private buildConfig(args: {
    tools: ToolId[];
    sources: Record<string, Source>;
    packs: Packs;
  }): Config {
    const { tools, sources, packs } = args;
    return {
      version: CONFIG_VERSION,
      tools,
      sources,
      packs,
    };
  }

  private writeConfig(configPath: string, config: Config): void {
    const configDirPath = path.dirname(configPath);
    const reference = renderConfigReference();
    const body = new Document(config).toString({ lineWidth: 0 });

    fs.mkdirSync(configDirPath, { recursive: true });
    fs.writeFileSync(configPath, `${reference}\n\n${body}`, 'utf-8');
  }
}
