import type { AnalysisResponse, ReportInsights } from '../types';

export const EMPTY_INSIGHTS: ReportInsights = {
  competitors: [],
  reviewSentiment: { available: false, topPraises: [], topComplaints: [] },
  regionalDemand: { available: false, states: [] },
  platformBenefits: [],
};

export function reportInsights(analysis: AnalysisResponse): ReportInsights {
  return analysis.insights ?? EMPTY_INSIGHTS;
}

export const REPORT_SECTIONS = [
  'overview',
  'pricing',
  'comparison',
  'competitors',
  'reviews',
  'listing',
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number];
