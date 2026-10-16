import fs from 'node:fs';
import path from 'node:path';

import type { ToolId } from '#catalog/tool/model.js';

import type { RenderedGuideline, ToolPlan } from './model.js';

export const DEFAULT_GUIDELINE_USAGE = 'Read this guideline before performing related work.';

type ReferenceFile = Extract<RenderedGuideline, { kind: 'reference-file' }> & { tools: ToolId[] };

export function collectReferenceFiles(toolPlans: ToolPlan[]): ReferenceFile[] {
  const byPath = new Map<string, ReferenceFile>();
  for (const { tool, renderedGuidelines } of toolPlans) {
    for (const guideline of renderedGuidelines) {
      if (guideline.kind !== 'reference-file') continue;
      const existing = byPath.get(guideline.filePath);
      if (existing) {
        existing.tools.push(tool);
      } else {
        byPath.set(guideline.filePath, { ...guideline, tools: [tool] });
      }
    }
  }
  return [...byPath.values()];
}

function isOutside(directory: string, target: string): boolean {
  const relativePath = path.relative(directory, target);
  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

export function resolveReferenceDirectory(projectPath: string, value: string): string {
  if (path.isAbsolute(value)) {
    throw new Error(`Reference directory '${value}' must be relative to the project root.`);
  }

  const target = path.resolve(projectPath, value);
  if (isOutside(projectPath, target)) {
    throw new Error(`Reference directory '${value}' must be inside the project.`);
  }

  let ancestor = target;
  while (!fs.lstatSync(ancestor, { throwIfNoEntry: false })) {
    ancestor = path.dirname(ancestor);
  }
  if (isOutside(fs.realpathSync(projectPath), fs.realpathSync(ancestor))) {
    throw new Error(`Reference directory '${value}' must be inside the project.`);
  }
  if (!fs.statSync(ancestor).isDirectory()) {
    throw new Error(
      `Reference directory '${value}' points to a file or has a parent that is a file.`,
    );
  }

  return path.relative(projectPath, target) || '.';
}
