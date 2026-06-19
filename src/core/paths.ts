import path from 'node:path';

export const AGENT_BOLT_DIR_NAME = '.agent-bolt';
export const CATALOG_CONFIG_FILENAME = 'catalog-config.yml';
export const INSTALL_LOCK_FILENAME = 'install-lock.json';
export const REVIEW_CONFIG_FILENAME = 'review-config.yml';

export function buildAgentBoltDirPath(projectPath: string): string {
  return path.join(projectPath, AGENT_BOLT_DIR_NAME);
}

export function buildCatalogConfigPath(projectPath: string): string {
  const agentBoltDir = buildAgentBoltDirPath(projectPath);
  return path.join(agentBoltDir, CATALOG_CONFIG_FILENAME);
}

export function buildInstallLockPath(projectPath: string): string {
  const agentBoltDir = buildAgentBoltDirPath(projectPath);
  return path.join(agentBoltDir, INSTALL_LOCK_FILENAME);
}
