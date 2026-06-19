import type { PackSummary, PackDetail } from './pack/model.js';

export type SourceCatalogSummary = {
  alias: string;
  type: string;
  packs: PackSummary[];
};

export type SourceCatalogDetail = {
  alias: string;
  type: string;
  packs: PackDetail[];
};
