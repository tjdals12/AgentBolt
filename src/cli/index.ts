import { Command } from 'commander';
import dedent from 'dedent';

import { createRequire } from 'node:module';
import path from 'node:path';
import { ConsoleOutput } from '#core/output.js';

import { collect } from './helpers.js';
import { withPager } from './pager.js';
import { renderInitResult } from './views/init.js';
import { renderListPacksResult } from './views/list-packs.js';
import { renderListItemsResult } from './views/list-items.js';
import { renderAddPackResult } from './views/add-pack.js';
import { renderRemovePackResult } from './views/remove-pack.js';
import { renderSyncResult } from './views/sync.js';
import { ProgressReporter } from '#core/progress.js';
import { renderCheckResult } from './views/check.js';
import { renderAddItemResult } from './views/add-item.js';
import { renderRemoveItemResult } from './views/remove-item.js';
import { renderShowItemResult } from './views/show-item.js';
import { renderValidateCatalogResult } from './views/catalog/validate-catalog.js';
import { renderInitCatalogResult } from './views/catalog/init-catalog.js';
import { renderNewPackResult } from './views/catalog/new-pack.js';
import { renderNewSkillResult } from './views/catalog/new/new-skill.js';
import { renderNewAgentResult } from './views/catalog/new/new-agent.js';
import { renderNewGuidelineResult } from './views/catalog/new/new-guideline.js';
import { printJson, printJsonError } from './json.js';

const program = new Command();
const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

program.name('agent-bolt').version(version);

program
  .command('init')
  .description('Initialize agent playbook in this project')
  .option('--tools <list>', 'codex,claude,cursor,copilot,opencode (omit to pick interactively)')
  .option(
    '--source <spec>',
    'Catalog source as <alias>=<type>:<location> (repeatable). e.g. team=git:https://github.com/acme/catalog.git',
    collect,
    [],
  )
  .option('--force', 'Overwrite an existing config.yml', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt init
      $ agent-bolt init --tools=codex,claude,cursor,copilot,opencode
      $ agent-bolt init --tools=codex,claude,cursor,copilot,opencode --source=dev=local:./catalog
      $ agent-bolt init --tools=codex,claude,cursor,copilot,opencode --source common=local:./catalog --source acme-team=git:https://github.com/acme/catalog.git
      $ agent-bolt init --tools=codex,claude,cursor,copilot,opencode --force
  `,
  )
  .action(async (options: { tools?: string; source: string[]; force: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { InitCommand } = await import('#catalog/commands/init.js');
      const command = new InitCommand(options);
      const result = await command.execute(projectPath);
      renderInitResult(result, projectPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program
  .command('list-packs')
  .description('List the packs provided by the configured sources')
  .option('--source <alias>', 'Filter to a specific source (default: all sources)')
  .option('--no-pager', 'Print directly without the pager')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt list-packs
      $ agent-bolt list-packs --source=common
    `,
  )
  .action(async (options: { source?: string; pager: boolean; json: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { ListPacksCommand } = await import('#catalog/commands/list-packs.js');
      const reporter = ProgressReporter.create({ silent: options.json });
      const command = new ListPacksCommand(options);
      const result = command.execute(projectPath, reporter);
      if (options.json) {
        printJson(command.toJson(result));
      } else {
        withPager(() => renderListPacksResult(result), options.pager);
      }
    } catch (e) {
      if (options.json) {
        printJsonError(e);
        process.exitCode = 1;
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program
  .command('list-items')
  .description('List the items in each pack of the configured sources')
  .option('--source <alias>', 'Filter to a specific source (default: all sources)')
  .option('--packs <list>', 'Filter to specific packs by name (comma separated)')
  .option('--no-pager', 'Print directly without the pager')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt list-items
      $ agent-bolt list-items --source=common
      $ agent-bolt list-items --packs=git-workflows,frontend
      $ agent-bolt list-items --source=common --packs=git-workflows,frontend
    `,
  )
  .action(async (options: { source?: string; packs?: string; pager: boolean; json: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { ListItemsCommand } = await import('#catalog/commands/list-items.js');
      const command = new ListItemsCommand(options);
      const result = command.execute(projectPath);
      if (options.json) {
        printJson(command.toJson(result));
      } else {
        withPager(() => renderListItemsResult(result), options.pager);
      }
    } catch (e) {
      if (options.json) {
        printJsonError(e);
        process.exitCode = 1;
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program
  .command('show-item')
  .description('Show full details of an item in a pack (description, instructions, assets)')
  .requiredOption('--source <alias>', 'Source alias the pack belongs to (required)')
  .requiredOption('--pack <name>', 'Pack name the item belongs to (required)')
  .requiredOption('--item <name>', 'Item name to show (required)')
  .option('--no-pager', 'Print directly without the pager')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt show-item --source=common --pack=git-workflow --item=create-commit
    `,
  )
  .action(
    async (options: {
      source: string;
      pack: string;
      item: string;
      pager: boolean;
      json: boolean;
    }) => {
      const projectPath = process.cwd();
      try {
        const { ShowItemCommand } = await import('#catalog/commands/show-item.js');
        const command = new ShowItemCommand(options);
        const result = command.execute(projectPath);
        if (options.json) {
          printJson(command.toJson(result));
        } else {
          withPager(() => renderShowItemResult(result), options.pager);
        }
      } catch (e) {
        if (options.json) {
          printJsonError(e);
          process.exitCode = 1;
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        ConsoleOutput.error(message);
        process.exit(1);
      }
    },
  );

program
  .command('add-pack')
  .description('Add whole packs from a source to the config (all items included)')
  .option('--source <alias>', 'Target source to add the packs to. Omit to pick interactively')
  .option('--packs <list>', 'Pack names to add (comma separated). Omit to pick interactively')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt add-pack  # pick a source, then packs, interactively
      $ agent-bolt add-pack --source=common  # pick packs interactively
      $ agent-bolt add-pack --source=common --packs=git-workflow
      $ agent-bolt add-pack --source=common --packs=git-workflow,code-review
    `,
  )
  .action(async (options: { source?: string; packs?: string; json: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { AddPackCommand } = await import('#catalog/commands/add-pack.js');
      const reporter = ProgressReporter.create({ silent: options.json });
      const command = new AddPackCommand(options);
      const result = await command.execute(projectPath, reporter);
      if (options.json) {
        printJson(command.toJson(result));
      } else {
        renderAddPackResult(result);
      }
    } catch (e) {
      if (options.json) {
        printJsonError(e);
        process.exitCode = 1;
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program
  .command('remove-pack')
  .description('Remove whole packs from a source in the config')
  .option('--source <alias>', 'Target source to remove the packs from. Omit to pick interactively')
  .option('--packs <list>', 'Pack names to remove (comma separated). Omit to pick interactively')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt remove-pack  # pick a source, then packs, interactively
      $ agent-bolt remove-pack --source=common  # pick packs interactively
      $ agent-bolt remove-pack --source=common --packs=git-workflow
      $ agent-bolt remove-pack --source=common --packs=git-workflow,code-review
    `,
  )
  .action(async (options: { source?: string; packs?: string; json: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { RemovePackCommand } = await import('#catalog/commands/remove-pack.js');
      const command = new RemovePackCommand(options);
      const result = await command.execute(projectPath);
      if (options.json) {
        printJson(command.toJson(result));
      } else {
        renderRemovePackResult(result);
      }
    } catch (e) {
      if (options.json) {
        printJsonError(e);
        process.exitCode = 1;
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program
  .command('add-item')
  .description('Add items to a source/pack in the config (creates the pack section if missing)')
  .option('--source <alias>', 'Target source to add the items to. Omit to pick interactively')
  .option('--pack <name>', 'Target pack to add the items to. Omit to pick interactively')
  .option('--skills <list>', 'Skill names to add (comma separated)')
  .option('--agents <list>', 'Agent names to add (comma separated)')
  .option('--guidelines <list>', 'Guideline names to add (comma separated)')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt add-item  # pick a source, then packs and items, interactively
      $ agent-bolt add-item --source=common  # pick packs, then items, interactively
      $ agent-bolt add-item --source=common --pack=git-workflow  # pick items interactively
      $ agent-bolt add-item --source=common --pack=git-workflow --skills=create-commit,clean-code
      $ agent-bolt add-item --source=common --pack=git-workflow --skills=create-commit --agents=code-reviewer
    `,
  )
  .action(
    async (options: {
      source?: string;
      pack?: string;
      skills?: string;
      agents?: string;
      guidelines?: string;
      json: boolean;
    }) => {
      const projectPath = process.cwd();
      try {
        const { AddItemCommand } = await import('#catalog/commands/add-item.js');
        const reporter = ProgressReporter.create({ silent: options.json });
        const command = new AddItemCommand(options);
        const result = await command.execute(projectPath, reporter);
        if (options.json) {
          printJson(command.toJson(result));
        } else {
          renderAddItemResult(result);
        }
      } catch (e) {
        if (options.json) {
          printJsonError(e);
          process.exitCode = 1;
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        ConsoleOutput.error(message);
        process.exit(1);
      }
    },
  );

program
  .command('remove-item')
  .description(
    'Remove items from a source/pack in the config (prunes the pack section if it becomes empty)',
  )
  .option('--source <alias>', 'Target source to remove the items from. Omit to pick interactively')
  .option('--pack <name>', 'Target pack to remove the items from. Omit to pick interactively')
  .option('--skills <list>', 'Skill names to remove (comma separated)')
  .option('--agents <list>', 'Agent names to remove (comma separated)')
  .option('--guidelines <list>', 'Guideline names to remove (comma separated)')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt remove-item  # pick a source, then packs and items, interactively
      $ agent-bolt remove-item --source=common  # pick packs, then items, interactively
      $ agent-bolt remove-item --source=common --pack=git-workflow  # pick items interactively
      $ agent-bolt remove-item --source=common --pack=git-workflow --skills=create-commit,clean-code
      $ agent-bolt remove-item --source=common --pack=git-workflow --skills=create-commit --agents=code-reviewer
    `,
  )
  .action(
    async (options: {
      source?: string;
      pack?: string;
      skills?: string;
      agents?: string;
      guidelines?: string;
      json: boolean;
    }) => {
      const projectPath = process.cwd();
      try {
        const { RemoveItemCommand } = await import('#catalog/commands/remove-item.js');
        const command = new RemoveItemCommand(options);
        const result = await command.execute(projectPath);
        if (options.json) {
          printJson(command.toJson(result));
        } else {
          renderRemoveItemResult(result);
        }
      } catch (e) {
        if (options.json) {
          printJsonError(e);
          process.exitCode = 1;
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        ConsoleOutput.error(message);
        process.exit(1);
      }
    },
  );

program
  .command('sync')
  .description('Install configured tools into each selected tool')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt sync
    `,
  )
  .action(async (option: { json: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { SyncCommand } = await import('#catalog/commands/sync.js');
      const command = new SyncCommand();
      const result = command.execute(projectPath);
      if (option.json) {
        printJson(command.toJson(result));
      } else {
        renderSyncResult(result);
      }
    } catch (e) {
      if (option.json) {
        printJsonError(e);
        process.exitCode = 1;
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check whether installed tools have drifted from the config')
  .option('--json', 'Print the result as JSON', false)
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt check
    `,
  )
  .action(async (options: { json: boolean }) => {
    const projectPath = process.cwd();
    try {
      const { CheckCommand } = await import('#catalog/commands/check.js');
      const command = new CheckCommand();
      const { checkResult, drifted } = command.execute(projectPath);
      if (options.json) {
        printJson(command.toJson({ checkResult, drifted }));
      } else {
        renderCheckResult(checkResult);
      }
      if (drifted) {
        process.exitCode = 1;
      }
    } catch (e) {
      if (options.json) {
        printJsonError(e);
        process.exitCode = 1;
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

const catalog = program
  .command('catalog')
  .description('Author catalogs (init, validate, new-pack, new-skill, new-agent, new-guideline)');

catalog
  .command('validate')
  .description('Validate a catalog directory (structure, manifests, integrity)')
  .option('--dir <dir>', 'Catalog directory (default: current directory)')
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt catalog validate
      $ agent-bolt catalog validate --dir=./my-catalog
    `,
  )
  .action(async (options: { dir?: string }) => {
    const { dir } = options;
    const projectPath = process.cwd();
    const catalogDirPath = dir ? path.resolve(projectPath, dir) : projectPath;
    try {
      const { ValidateCatalogCommand } =
        await import('#catalog/commands/catalog/validate-catalog.js');
      const command = new ValidateCatalogCommand();
      const { validateCatalogResult, invalid } = command.execute(catalogDirPath);
      renderValidateCatalogResult(validateCatalogResult);
      if (invalid) {
        process.exitCode = 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

catalog
  .command('init')
  .description('Initialize a new catalog here (catalog.json + packs/)')
  .option('--dir <dir>', 'Catalog directory (default: current directory)')
  .option('--name <name>', 'Catalog name (default: target directory name)')
  .option('--description <text>', 'Catalog description (default: a TODO placeholder)')
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt catalog init
      $ agent-bolt catalog init --dir=./my-catalog --name=acme-catalog
    `,
  )
  .action(async (options: { dir?: string; name?: string; description?: string }) => {
    const { dir, name, description } = options;
    const projectPath = process.cwd();
    const catalogDir = dir ? path.resolve(projectPath, dir) : projectPath;
    try {
      const { InitCatalogCommand } = await import('#catalog/commands/catalog/init-catalog.js');
      const command = new InitCatalogCommand({ name, description });
      const result = command.execute(catalogDir);
      renderInitCatalogResult(result, projectPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

catalog
  .command('new-pack <name>')
  .description('Create a new pack skeleton (packs/<name>/pack.json)')
  .option('--dir <dir>', 'Catalog directory (default: current directory)')
  .option('--description <text>', 'Pack description (default: a TODO placeholder)')
  .addHelpText(
    'after',
    dedent`
    Examples:
      $ agent-bolt catalog new-pack git-workflow
      $ agent-bolt catalog new-pack git-workflow --dir=./my-catalog
      $ agent-bolt catalog new-pack git-workflow --description="Commit and PR helpers"
    `,
  )
  .action(async (name: string, options: { dir?: string; description?: string }) => {
    const { dir, description } = options;
    const projectPath = process.cwd();
    const catalogDir = dir ? path.resolve(projectPath, dir) : projectPath;
    try {
      const { NewPackCommand } = await import('#catalog/commands/catalog/new-pack.js');
      const command = new NewPackCommand({
        name,
        description,
      });
      const result = command.execute(catalogDir);
      renderNewPackResult(result, projectPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

catalog
  .command('new-skill <name>')
  .description('Create a new skill skeleton (packs/<pack>/skills/<name>/)')
  .requiredOption('--pack <name>', 'Parent pack the skill belongs to (required)')
  .option('--dir <dir>', 'Catalog directory (default: current directory)')
  .option('--description <text>', 'Skill description (default: a TODO placeholder)')
  .addHelpText(
    'after',
    dedent`
    Name:
      Lowercase letters, digits, and hyphens (kebab-case), e.g. create-commit.

    Examples:
      $ agent-bolt catalog new-skill create-commit --pack=git-workflow
      $ agent-bolt catalog new-skill create-commit --pack=git-workflow --dir=./my-catalog
      $ agent-bolt catalog new-skill create-commit --pack=git-workflow --description="Create commit" --dir=./my-catalog
    `,
  )
  .action(async (name: string, options: { pack: string; dir?: string; description?: string }) => {
    const { pack, dir, description } = options;
    const projectPath = process.cwd();
    const catalogDir = dir ? path.resolve(projectPath, dir) : projectPath;
    try {
      const { NewSkillCommand } = await import('#catalog/commands/catalog/new/new-skill.js');
      const command = new NewSkillCommand({
        pack,
        name,
        description,
      });
      const result = command.execute(catalogDir);
      renderNewSkillResult(result, projectPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

catalog
  .command('new-agent <name>')
  .description('Create a new agent skeleton (packs/<pack>/agents/<name>/)')
  .requiredOption('--pack <name>', 'Parent pack the agent belongs to (required)')
  .option('--dir <dir>', 'Catalog directory (default: current directory)')
  .option('--description <text>', 'Agent description (default: a TODO placeholder)')
  .addHelpText(
    'after',
    dedent`
    Name:
      Lowercase letters, digits, and hyphens (kebab-case), e.g. code-reviewer.

    Examples:
      $ agent-bolt catalog new-agent code-reviewer --pack=git-workflow
      $ agent-bolt catalog new-agent code-reviewer --pack=git-workflow --dir=./my-catalog
    `,
  )
  .action(async (name: string, options: { pack: string; dir?: string; description?: string }) => {
    const { pack, dir, description } = options;
    const projectPath = process.cwd();
    const catalogDir = dir ? path.resolve(projectPath, dir) : projectPath;
    try {
      const { NewAgentCommand } = await import('#catalog/commands/catalog/new/new-agent.js');
      const command = new NewAgentCommand({ pack, name, description });
      const result = command.execute(catalogDir);
      renderNewAgentResult(result, projectPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

catalog
  .command('new-guideline <name>')
  .description('Create a new guideline skeleton (packs/<pack>/guidelines/<name>/)')
  .requiredOption('--pack <name>', 'Parent pack the guideline belongs to (required)')
  .option('--dir <dir>', 'Catalog directory (default: current directory)')
  .option('--description <text>', 'Guideline description (default: a TODO placeholder)')
  .addHelpText(
    'after',
    dedent`
    Name:
      Lowercase letters, digits, and hyphens (kebab-case), e.g. commit-rules.

    Examples:
      $ agent-bolt catalog new-guideline commit-rules --pack=git-workflow
      $ agent-bolt catalog new-guideline commit-rules --pack=git-workflow --dir=./my-catalog
    `,
  )
  .action(async (name: string, options: { pack: string; dir?: string; description?: string }) => {
    const { pack, dir, description } = options;
    const projectPath = process.cwd();
    const catalogDir = dir ? path.resolve(projectPath, dir) : projectPath;
    try {
      const { NewGuidelineCommand } =
        await import('#catalog/commands/catalog/new/new-guideline.js');
      const command = new NewGuidelineCommand({ pack, name, description });
      const result = command.execute(catalogDir);
      renderNewGuidelineResult(result, projectPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ConsoleOutput.error(message);
      process.exit(1);
    }
  });

program.parse();
