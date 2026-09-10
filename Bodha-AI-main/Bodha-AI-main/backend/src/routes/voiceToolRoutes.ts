/**
 * ElevenLabs Conversational AI server-tool webhooks.
 *
 * These URLs / query shapes must match the Server Tools configured on the
 * existing agent in the ElevenLabs dashboard. They only read stored reports.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

import {
  getCompetitorAnalysis,
  getPriceExplanation,
  getRegionalDemand,
  getReportSummary,
  getReviewSentiment,
  parseVoiceToolLanguage,
} from '../services/voiceToolsService.js';

export const voiceToolRoutes = Router();

function readQuery(req: Request, ...keys: string[]): string {
  for (const key of keys) {
    const value = req.query[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toolQuery(req: Request): { productId: string; language: ReturnType<typeof parseVoiceToolLanguage> } {
  return {
    productId: readQuery(req, 'productId', 'product_id'),
    language: parseVoiceToolLanguage(readQuery(req, 'language')),
  };
}

voiceToolRoutes.get('/report-summary', (req: Request, res: Response) => {
  const { productId, language } = toolQuery(req);
  res.json(getReportSummary(productId, language));
});

voiceToolRoutes.get('/price-explanation', (req: Request, res: Response) => {
  const { productId, language } = toolQuery(req);
  res.json(getPriceExplanation(productId, language));
});

voiceToolRoutes.get('/competitor-analysis', (req: Request, res: Response) => {
  const { productId, language } = toolQuery(req);
  res.json(getCompetitorAnalysis(productId, language));
});

voiceToolRoutes.get('/review-sentiment', (req: Request, res: Response) => {
  const { productId, language } = toolQuery(req);
  res.json(getReviewSentiment(productId, language));
});

voiceToolRoutes.get('/regional-demand', (req: Request, res: Response) => {
  const { productId, language } = toolQuery(req);
  res.json(getRegionalDemand(productId, language));
});
