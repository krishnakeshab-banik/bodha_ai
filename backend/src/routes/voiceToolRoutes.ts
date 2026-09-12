/**
 * ElevenLabs Conversational AI server-tool webhooks.
 *
 * These URLs / query shapes must match the Server Tools configured on the
 * existing agent in the ElevenLabs dashboard. They only read stored reports.
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import {
  getCompetitorAnalysis,
  getPriceExplanation,
  getRegionalDemand,
  getReportSummary,
  getReviewSentiment,
  parseVoiceToolLanguage,
} from '../services/voiceToolsService.js';

export const voiceToolRoutes = Router();

/**
 * These webhooks are called by ElevenLabs' servers, not the seller's browser,
 * so there is no session cookie to check — only a shared secret configured on
 * both sides can tell a real tool call apart from anyone on the internet who
 * finds the URL and a productId. Stays open in local dev, where the secret is
 * unset, matching this project's other optional-in-dev secrets.
 */
function requireToolSecret(req: Request, _res: Response, next: NextFunction): void {
  if (!env.elevenLabsToolSecret) {
    next();
    return;
  }
  const provided = req.get('x-tool-secret') ?? '';
  if (provided !== env.elevenLabsToolSecret) {
    next(HttpError.unauthorized('Invalid or missing tool secret'));
    return;
  }
  next();
}

voiceToolRoutes.use(requireToolSecret);

function readQuery(req: Request, ...keys: string[]): string {
  for (const key of keys) {
    const value = req.query[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toolQuery(req: Request): {
  productId: string;
  language: ReturnType<typeof parseVoiceToolLanguage>;
} {
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
