/**
 * REST routes for products and analyses.
 *
 *   POST /api/products/analyze
 *   GET  /api/products/history
 *   GET  /api/products/:id
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { requireUser } from '../middleware/auth.js';
import { creditStatus } from '../models/userRepository.js';
import { inferListingFromPhoto } from '../services/autoInsightService.js';
import { createAnalysis, getAnalysis, getHistory } from '../services/analysisService.js';
import { renderReportPdf, reportPdfFilename } from '../services/pdfReport.js';
import { HttpError } from '../utils/httpError.js';
import { parseAnalyzeRequest, parseInsightRequest } from '../utils/validation.js';
import type { UiLanguage } from '../types/index.js';

export const productRoutes = Router();

productRoutes.post(
  '/analyze',
  requireUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const credits = creditStatus(req.user!);
      if (credits.plan === 'free' && (credits.remaining ?? 0) <= 0) {
        throw HttpError.paymentRequired(
          'You have used your 6 free analyses this month. Subscribe to continue.',
          { credits },
        );
      }
      const parsed = parseAnalyzeRequest(req.body);
      const record = await createAnalysis(parsed, req.user!.id);
      res.status(201).json({ ...record, credits: creditStatus(req.user!) });
    } catch (error) {
      next(error);
    }
  },
);

productRoutes.post(
  '/insight',
  requireUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = parseInsightRequest(req.body);
      const insight = await inferListingFromPhoto(parsed.imageUrl, parsed.language);
      res.json(insight);
    } catch (error) {
      next(error);
    }
  },
);

productRoutes.get('/history', requireUser, (req: Request, res: Response, next: NextFunction): void => {
  try {
    res.json(getHistory(req.user!.id));
  } catch (error) {
    next(error);
  }
});

productRoutes.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = String(req.params.id);
    const record = await getAnalysis(productId);
    if (!record) {
      throw HttpError.notFound('No analysis found for product "' + productId + '"');
    }
    const language = (['en', 'hi', 'ta'] as const).includes(req.query.lang as UiLanguage)
      ? (req.query.lang as UiLanguage)
      : record.insights.language;
    const pdf = await renderReportPdf(record, language);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + reportPdfFilename(record) + '"');
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

productRoutes.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = String(req.params.id);
    const record = await getAnalysis(productId);
    if (!record) {
      throw HttpError.notFound('No analysis found for product "' + productId + '"');
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});
