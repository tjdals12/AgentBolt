import path from 'node:path';
import fs from 'node:fs';

import { AGENT_BOLT_DIR_NAME, buildAgentBoltDirPath } from '#core/paths.js';
import type { Source } from '#catalog/source/schema.js';

type LocalSource = Extract<Source, { type: 'local' }>;

export function resolveLocalSource(
  projectPath: string,
  alias: string,
  source: LocalSource,
): string {
  const agentBoltDirPath = buildAgentBoltDirPath(projectPath);
  const sourceDirPath = path.resolve(agentBoltDirPath, source.path);
  const sourceDirExists = fs.existsSync(sourceDirPath);
  if (!sourceDirExists) {
    throw new Error(
      `source '${alias}': catalog path not found: ${sourceDirPath} (check 'path: ${source.path}' in config - relative to ${AGENT_BOLT_DIR_NAME}/)`,
    );
  }
  return sourceDirPath;
}
