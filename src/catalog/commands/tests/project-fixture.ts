import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

type ToolConfig = Record<string, Record<string, unknown>>;
type GuidelineLoad = { load: 'always' } | { load: 'conditional'; glob: string[] };

export interface SkillSpec {
  description?: string;
  instructions?: string;
  toolConfig?: ToolConfig;
  files?: Record<string, string>;
  assets?: string[];
}

export interface AgentSpec {
  description?: string;
  instructions?: string;
  toolConfig?: ToolConfig;
}

export interface GuidelineSpec {
  description?: string;
  body?: string;
  recommended?: GuidelineLoad;
}

export interface PackSpec {
  description?: string;
  skills?: Record<string, SkillSpec>;
  agents?: Record<string, AgentSpec>;
  guidelines?: Record<string, GuidelineSpec>;
}

export interface CatalogSpec {
  packs: Record<string, PackSpec>;
}

type SourceSpec =
  | { type: 'local'; path: string }
  | { type: 'git'; url: string; ref?: string; subdir?: string };

interface PackSelectionSpec {
  skills?: string[];
  agents?: string[];
  guidelines?: Record<string, GuidelineLoad>;
}

export interface ConfigSpec {
  tools: string[];
  sources: Record<string, SourceSpec>;
  packs: Record<string, Record<string, PackSelectionSpec>>;
}

export interface TempProject {
  projectPath: string;
  cleanup: () => void;
  read: (relPath: string) => string;
  exists: (relPath: string) => boolean;
  write: (relPath: string, content: string) => void;
  mtimeMs: (relPath: string) => number;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function createProject(): TempProject {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bolt-it-'));
  const resolve = (relPath: string): string => path.join(projectPath, relPath);
  return {
    projectPath,
    cleanup: () => fs.rmSync(projectPath, { recursive: true, force: true }),
    read: (relPath) => fs.readFileSync(resolve(relPath), 'utf-8'),
    exists: (relPath) => fs.existsSync(resolve(relPath)),
    write: (relPath, content) => writeText(resolve(relPath), content),
    mtimeMs: (relPath) => fs.statSync(resolve(relPath)).mtimeMs,
  };
}

export function writeCatalog(
  projectPath: string,
  spec: CatalogSpec,
  catalogRelPath = 'catalog',
): string {
  const catalogDir = path.join(projectPath, '.agent-bolt', catalogRelPath);
  fs.mkdirSync(catalogDir, { recursive: true });
  writeJson(path.join(catalogDir, 'catalog.json'), { schemaVersion: 1 });

  for (const [packName, pack] of Object.entries(spec.packs)) {
    const packDir = path.join(catalogDir, 'packs', packName);
    writeJson(path.join(packDir, 'pack.json'), {
      name: packName,
      description: pack.description ?? `${packName} pack`,
    });

    for (const [name, skill] of Object.entries(pack.skills ?? {})) {
      const dir = path.join(packDir, 'skills', name);
      const manifest: Record<string, unknown> = {
        name,
        description: skill.description ?? `${name} skill`,
        instructions: './instructions.md',
      };
      if (skill.toolConfig) manifest.toolConfig = skill.toolConfig;
      if (skill.assets && skill.assets.length > 0) manifest.assets = skill.assets;
      writeJson(path.join(dir, 'skill.json'), manifest);
      writeText(path.join(dir, 'instructions.md'), skill.instructions ?? `# ${name}\n`);
      for (const [assetPath, content] of Object.entries(skill.files ?? {})) {
        writeText(path.join(dir, assetPath), content);
      }
    }

    for (const [name, agent] of Object.entries(pack.agents ?? {})) {
      const dir = path.join(packDir, 'agents', name);
      const manifest: Record<string, unknown> = {
        name,
        description: agent.description ?? `${name} agent`,
        instructions: './prompt.md',
      };
      if (agent.toolConfig) manifest.toolConfig = agent.toolConfig;
      writeJson(path.join(dir, 'agent.json'), manifest);
      writeText(path.join(dir, 'prompt.md'), agent.instructions ?? `# ${name}\n`);
    }

    for (const [name, guideline] of Object.entries(pack.guidelines ?? {})) {
      const dir = path.join(packDir, 'guidelines', name);
      writeJson(path.join(dir, 'guideline.json'), {
        name,
        description: guideline.description ?? `${name} guideline`,
        body: './content.md',
        recommended: guideline.recommended ?? { load: 'always' },
      });
      writeText(path.join(dir, 'content.md'), guideline.body ?? `${name} body\n`);
    }
  }

  return catalogDir;
}

export function writeConfig(projectPath: string, config: ConfigSpec): void {
  const document = { version: 1, ...config };
  const yaml = stringifyYaml(document, { lineWidth: 0 });
  writeText(path.join(projectPath, '.agent-bolt', 'catalog-config.yml'), yaml);
}
