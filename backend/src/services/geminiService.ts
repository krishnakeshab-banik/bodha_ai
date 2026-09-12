/**
 * Gemini REST client. Used by the listing optimizer and the voice agent.
 *
 * A missing key is a normal demo state — callers fall back to templates.
 */

import { env } from '../config/env.js';

const GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  encodeURIComponent(env.geminiModel) +
  ':generateContent';

export function hasGeminiKey(): boolean {
  return Boolean(env.geminiApiKey);
}

export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string };
}

/** Ask Gemini for free-form text. Throws if the key is missing or the call fails. */
export async function generateText(prompt: string): Promise<string> {
  return generateContent([{ text: prompt }]);
}

/** Ask Gemini to look at an image and return JSON. */
export async function generateVisionJson<T>(imageDataUrl: string, prompt: string): Promise<T> {
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) {
    throw new GeminiError('Image was not a usable data URL');
  }

  const raw = await generateContent([
    { text: prompt + '\n\nReturn ONLY valid JSON. Do not wrap it in commentary.' },
    { inline_data: { mime_type: parsed.mimeType, data: parsed.base64 } },
  ]);
  return parseJsonObject<T>(raw);
}

interface GeminiRequestPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function generateContent(parts: GeminiRequestPart[]): Promise<string> {
  if (!env.geminiApiKey) {
    throw new GeminiError('GEMINI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(GENERATE_URL + '?key=' + encodeURIComponent(env.geminiApiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });

    const body = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new GeminiError(
        body.error?.message ?? 'Gemini request failed (' + response.status + ')',
      );
    }

    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new GeminiError('Gemini returned an empty response');
    }

    return text;
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GeminiError('Gemini request timed out');
    }
    throw new GeminiError(error instanceof Error ? error.message : 'Gemini request failed');
  } finally {
    clearTimeout(timeout);
  }
}

function parseDataUrl(value: string): { mimeType: string; base64: string } | null {
  const match = value.trim().match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2].replace(/\s/g, '') };
}

/** Ask Gemini for a JSON object and parse it out of optional markdown fences. */
export async function generateJson<T>(prompt: string): Promise<T> {
  const raw = await generateText(
    prompt + '\n\nReturn ONLY valid JSON. Do not wrap it in commentary.',
  );
  return parseJsonObject<T>(raw);
}

export function parseJsonObject<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new GeminiError('Gemini response was not JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
