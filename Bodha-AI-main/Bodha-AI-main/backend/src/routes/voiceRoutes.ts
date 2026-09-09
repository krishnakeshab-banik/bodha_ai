/**
 * Voice agent REST route: POST /api/voice/query
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { answerVoiceQuery } from '../services/voiceService.js';
import { HttpError } from '../utils/httpError.js';
import type { SpokenLanguage } from '../services/voiceLanguage.js';

export const voiceRoutes = Router();

const voiceQuerySchema = z.object({
  text: z.string().trim().min(1, 'Ask a question').max(1000),
  language: z.enum(['en', 'hi', 'ta', 'hinglish']).optional().default('en'),
  context: z
    .object({
      productId: z.string().max(80).optional(),
      page: z.string().max(80).optional(),
      currentReport: z.unknown().optional(),
    })
    .optional(),
});

voiceRoutes.post(
  '/query',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = voiceQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        }));
        throw HttpError.badRequest(details[0]?.message ?? 'Invalid voice query', details);
      }

      const result = await answerVoiceQuery({
        text: parsed.data.text,
        language: parsed.data.language as SpokenLanguage,
        context: {
          ...parsed.data.context,
          authenticated: Boolean(req.user),
        },
      });

      res.json({ answer: result.answer, language: result.language, source: result.source });
    } catch (error) {
      next(error);
    }
  },
);
