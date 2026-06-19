import type { Config, Packs, Sources } from './schema.js';

function pruneOrphanPacks(
  sources: Sources,
  packs: Packs,
): { keptPacks: Packs; orphanedSourceAliases: string[] } {
  const sourceAliases = new Set(Object.keys(sources));
  const packEntries = Object.entries(packs);

  const keptPacks: Packs = {};
  const orphanedSourceAliases: string[] = [];

  for (const [sourceAlias, sourcePacks] of packEntries) {
    if (sourceAliases.has(sourceAlias)) {
      keptPacks[sourceAlias] = sourcePacks;
    } else {
      orphanedSourceAliases.push(sourceAlias);
    }
  }

  return {
    keptPacks,
    orphanedSourceAliases,
  };
}

export function normalizeConfig(config: Config): {
  config: Config;
  orphanedSourceAliases: string[];
} {
  const { sources, packs } = config;
  const { keptPacks, orphanedSourceAliases } = pruneOrphanPacks(sources, packs);
  return {
    config: {
      ...config,
      packs: keptPacks,
    },
    orphanedSourceAliases,
  };
}
