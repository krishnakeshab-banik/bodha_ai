/**
 * Request validation for the analyze endpoint, built on zod.
 *
 * The rules mirror the frontend form so a seller sees the same message
 * whichever side rejects the input.
 */

import { z } from 'zod';

import { CATEGORY_IDS } from '../data/categories.js';
import { PLATFORM_IDS } from '../data/platformConfig.js';
import { HttpError } from './httpError.js';

export const analyzeRequestSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(4000),
    category: z.enum(CATEGORY_IDS as unknown as [string, ...string[]], {
      errorMap: () => ({ message: 'Choose one of the supported categories' }),
    }),
    imageUrl: z.string().max(6_000_000).nullish(),
    manufacturingCost: z
      .number({ invalid_type_error: 'Manufacturing cost must be a number' })
      .positive('Manufacturing cost must be greater than 0'),
    currentPrice: z
      .number({ invalid_type_error: 'Current selling price must be a number' })
      .positive('Current selling price must be greater than 0'),
    platforms: z
      .array(z.enum(PLATFORM_IDS as unknown as [string, ...string[]]))
      .min(1, 'Select at least one marketplace')
      .max(PLATFORM_IDS.length),
    language: z.enum(['en', 'hi', 'ta']).optional().default('en'),
  })
  .refine((data) => data.manufacturingCost < data.currentPrice, {
    message: 'Manufacturing cost must be lower than the current selling price',
    path: ['manufacturingCost'],
  });

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const insightRequestSchema = z.object({
  imageUrl: z.string().min(20).max(6_000_000),
  language: z.enum(['en', 'hi', 'ta']).optional().default('en'),
});

export function parseInsightRequest(body: unknown): z.infer<typeof insightRequestSchema> {
  const result = insightRequestSchema.safeParse(body);
  if (result.success) return result.data;
  throw HttpError.badRequest('A product photo is required to auto-generate listing copy');
}

/** Parse a request body, converting zod issues into a 400 HttpError. */
export function parseAnalyzeRequest(body: unknown): AnalyzeRequest {
  const result = analyzeRequestSchema.safeParse(body);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));

  throw HttpError.badRequest(details[0]?.message ?? 'Invalid request body', details);
}
