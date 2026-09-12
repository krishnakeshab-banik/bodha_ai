/**
 * ElevenLabs session minting plus the on-site voice fallback.
 * Server tools live on /api/voice-tools/*.
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { answerVoiceQuery } from '../services/voiceService.js';
import { createVoiceSession } from '../services/voiceSessionService.js';
import { HttpError } from '../utils/httpError.js';

export const voiceRoutes = Router();

const querySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  language: z.enum(['en', 'hi', 'ta', 'hinglish']).optional(),
  context: z
    .object({
      productId: z.string().trim().min(1).max(80).optional(),
      page: z.string().trim().max(200).optional(),
    })
    .optional(),
});

voiceRoutes.get(
  '/session',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await createVoiceSession());
    } catch (error) {
      next(error);
    }
  },
);

voiceRoutes.post(
  '/query',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = querySchema.safeParse(req.body);
      if (!parsed.success) {
        throw HttpError.badRequest('Ask a short question about Bodha AI or this report.');
      }

      const result = await answerVoiceQuery({
        text: parsed.data.text,
        language: parsed.data.language,
        context: {
          ...parsed.data.context,
          authenticated: Boolean(req.user),
          sellerId: req.user?.id,
        },
      });

      res.json({ answer: result.answer, language: result.language, source: result.source });
    } catch (error) {
      next(error);
    }
  },
);
