import fs from 'node:fs';
import path from 'node:path';

function walkFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      }
      if (entry.isFile()) {
        files.push(rel);
      }
    }
  };
  walk(root, '');
  return files;
}

export function listAssetFiles(sourceDir: string, assets: string[]): string[] {
  const files: string[] = [];
  for (const asset of assets) {
    const assetPath = path.join(sourceDir, asset);
    const stat = fs.statSync(assetPath);
    if (stat.isDirectory()) {
      const nestedFiles = walkFiles(assetPath);
      for (const relPath of nestedFiles) {
        const filePath = path.join(asset, relPath);
        files.push(filePath);
      }
    } else {
      files.push(asset);
    }
  }
  return files;
}
