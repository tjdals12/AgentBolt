import fs from 'node:fs';
import path from 'node:path';

import { ITEM_TYPES, type Item, type ItemType } from '#catalog/content/item/model.js';
import {
  AGENTS_DIR_NAME,
  CATALOG_MANIFEST_FILENAME,
  GUIDELINES_DIR_NAME,
  PACKS_DIR_NAME,
  SKILLS_DIR_NAME,
} from '#catalog/content/schema.js';
import { loadCatalog } from '#catalog/content/load.js';
import { listPackDirs, parsePackSummary } from '#catalog/content/pack/parse.js';
import { PACK_MANIFEST_FILENAME } from '#catalog/content/pack/schema.js';
import { listItemDirs } from '#catalog/content/item/parse-summary.js';
import { findAgent, findGuideline, findSkill } from '#catalog/content/item/find-detail.js';
import {
  AGENT_MANIFEST_FILENAME,
  GUIDELINE_MANIFEST_FILENAME,
  SKILL_MANIFEST_FILENAME,
} from '#catalog/content/item/schema.js';

export type IssueSeverity = 'error' | 'warning';

export type ValidationIssue = {
  severity: IssueSeverity;
  location: string;
  message: string;
};

export type CatalogCounts = { packs: number; items: Record<ItemType, number> };

export type ValidateCatalogResult = {
  catalogDir: string;
  catalogCounts: CatalogCounts;
  validationIssues: ValidationIssue[];
};

export class ValidateCatalogCommand {
  execute(catalogDir: string): { validateCatalogResult: ValidateCatalogResult; invalid: boolean } {
    const catalogExists = fs.existsSync(catalogDir);
    if (!catalogExists) {
      throw new Error(`directory not found: ${catalogDir}`);
    }

    const manifestPath = path.join(catalogDir, CATALOG_MANIFEST_FILENAME);
    const manifestExists = fs.existsSync(manifestPath);
    if (!manifestExists) {
      throw new Error(`not a catalog directory: ${catalogDir} (no ${CATALOG_MANIFEST_FILENAME})`);
    }

    const validationIssues: ValidationIssue[] = [];
    const catalogCounts: CatalogCounts = {
      packs: 0,
      items: { skills: 0, agents: 0, guidelines: 0 },
    };

    try {
      loadCatalog(manifestPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      validationIssues.push({ severity: 'error', location: CATALOG_MANIFEST_FILENAME, message });
      return {
        validateCatalogResult: { catalogDir, catalogCounts, validationIssues },
        invalid: true,
      };
    }

    const packsDirPath = path.join(catalogDir, PACKS_DIR_NAME);
    const packDirs = listPackDirs(packsDirPath);
    if (packDirs.length === 0) {
      validationIssues.push({
        severity: 'warning',
        location: PACKS_DIR_NAME,
        message: 'no packs found.',
      });
    }
    catalogCounts.packs = packDirs.length;

    for (const packDir of packDirs) {
      const { packValidationIssues, packItemCounts } = this.validatePack(catalogDir, packDir);
      validationIssues.push(...packValidationIssues);
      for (const itemType of ITEM_TYPES) {
        catalogCounts.items[itemType] += packItemCounts[itemType];
      }
    }

    const invalid = validationIssues.some((issue) => issue.severity === 'error');

    return {
      validateCatalogResult: {
        catalogDir,
        catalogCounts,
        validationIssues,
      },
      invalid,
    };
  }

  private validatePack(
    catalogDir: string,
    packDir: string,
  ): { packValidationIssues: ValidationIssue[]; packItemCounts: Record<ItemType, number> } {
    const packManifestPath = path.join(packDir, PACK_MANIFEST_FILENAME);
    const packName = path.basename(packDir);

    const packValidationIssues: ValidationIssue[] = [];
    const packItemCounts: Record<ItemType, number> = { skills: 0, agents: 0, guidelines: 0 };

    try {
      const pack = parsePackSummary(packDir);
      if (pack.name !== packName) {
        packValidationIssues.push({
          severity: 'error',
          location: path.relative(catalogDir, packManifestPath),
          message: `name '${pack.name}' does not match directory '${packName}'.`,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      packValidationIssues.push({
        severity: 'error',
        location: path.relative(catalogDir, packManifestPath),
        message,
      });
    }

    let totalItemCount = 0;
    for (const itemType of ITEM_TYPES) {
      const { itemValidationIssues, itemCount } = this.validateItems(catalogDir, packDir, itemType);
      packValidationIssues.push(...itemValidationIssues);
      packItemCounts[itemType] = itemCount;
      totalItemCount += itemCount;
    }

    if (totalItemCount === 0) {
      packValidationIssues.push({
        severity: 'warning',
        location: path.relative(catalogDir, packDir),
        message: 'pack has no items.',
      });
    }

    return {
      packValidationIssues,
      packItemCounts,
    };
  }

  private validateItems(
    catalogDir: string,
    packDir: string,
    itemType: ItemType,
  ): { itemValidationIssues: ValidationIssue[]; itemCount: number } {
    const packName = path.basename(packDir);

    let typeDir: string;
    let manifestFileName: string;
    let findItem: (catalogDir: string, packName: string, itemName: string) => Item | null;
    switch (itemType) {
      case 'skills':
        typeDir = path.join(packDir, SKILLS_DIR_NAME);
        manifestFileName = SKILL_MANIFEST_FILENAME;
        findItem = findSkill;
        break;
      case 'agents':
        typeDir = path.join(packDir, AGENTS_DIR_NAME);
        manifestFileName = AGENT_MANIFEST_FILENAME;
        findItem = findAgent;
        break;
      case 'guidelines':
        typeDir = path.join(packDir, GUIDELINES_DIR_NAME);
        manifestFileName = GUIDELINE_MANIFEST_FILENAME;
        findItem = findGuideline;
        break;
    }

    const itemDirs = listItemDirs(typeDir);
    const itemValidationIssues: ValidationIssue[] = [];
    const itemCount = itemDirs.length;

    for (const itemDir of itemDirs) {
      const itemName = path.basename(itemDir);
      try {
        const item = findItem(catalogDir, packName, itemName);
        if (item === null) {
          itemValidationIssues.push({
            severity: 'error',
            location: path.relative(catalogDir, itemDir),
            message: `missing ${manifestFileName}`,
          });
        } else {
          if (item.name !== itemName) {
            itemValidationIssues.push({
              severity: 'error',
              location: path.relative(catalogDir, path.join(itemDir, manifestFileName)),
              message: `name '${item.name}' does not match directory '${itemName}'.`,
            });
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        itemValidationIssues.push({
          severity: 'error',
          location: path.relative(catalogDir, itemDir),
          message,
        });
      }
    }

    return {
      itemValidationIssues,
      itemCount,
    };
  }
}
