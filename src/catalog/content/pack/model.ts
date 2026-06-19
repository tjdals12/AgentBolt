import type { GuidelineItem, Item } from '../item/model.js';

export type PackSummary = {
  name: string;
  description: string;
  counts: {
    skills: number;
    agents: number;
    guidelines: number;
  };
};

export type PackDetail = {
  name: string;
  description: string;
  items: {
    skills: Item[];
    agents: Item[];
    guidelines: GuidelineItem[];
  };
};
