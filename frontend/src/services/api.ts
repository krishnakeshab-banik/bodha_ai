/**
 * The single HTTP entry point for the app. No component calls `fetch`
 * directly - every request goes through `request()` so error handling,
 * base-URL resolution and JSON parsing stay in one place.
 */

import {
  clearNativeSessionToken,
  getNativeSessionToken,
  saveNativeSessionToken,
} from '@native/session';
import { sharePdfBlob } from '@native/share';

import type {
  AnalysisResponse,
  AnalyzeRequest,
  ApiErrorBody,
  AuthUser,
  AutoInsightResponse,
  BillingOrder,
  BillingPlan,
  HistoryItem,
  MetaResponse,
  VoiceQueryResponse,
  VoiceSessionResponse,
} from '../types';

/**
 * Empty in development so requests stay same-origin and are forwarded by the
 * Vite dev-server proxy (see vite.config.ts).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** An API failure carrying the server's structured error payload. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: { field: string; message: string }[];

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error?.message ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code ?? 'UNKNOWN';
    this.fieldErrors = body?.error?.details ?? [];
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const nativeToken = await getNativeSessionToken();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (nativeToken && !headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer ' + nativeToken);
  }

  try {
    response = await fetch(API_BASE_URL + path, {
      credentials: 'include',
      ...init,
      headers,
    });
  } catch {
    // Network-level failure: the API is unreachable rather than unhappy.
    throw new ApiError(0, null, 'Cannot reach the Bodha AI server. Is the backend running?');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body, 'Request failed with status ' + response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  analyzeProduct(payload: AnalyzeRequest): Promise<AnalysisResponse> {
    return request<AnalysisResponse>('/api/products/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  inferFromPhoto(payload: {
    imageUrl: string;
    language?: 'en' | 'hi' | 'ta';
  }): Promise<AutoInsightResponse> {
    return request<AutoInsightResponse>('/api/products/insight', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async downloadReportPdf(productId: string, language: 'en' | 'hi' | 'ta'): Promise<void> {
    const response = await fetch(
      API_BASE_URL + '/api/products/' + encodeURIComponent(productId) + '/pdf?lang=' + language,
      { credentials: 'include' },
    );
    if (!response.ok) {
      throw new ApiError(response.status, null, 'Could not download the PDF report.');
    }
    const blob = await response.blob();
    const header = response.headers.get('Content-Disposition') ?? '';
    const match = header.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? 'BodhaAI_Report.pdf';
    if (await sharePdfBlob(blob, filename)) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  getHistory(): Promise<HistoryItem[]> {
    return request<HistoryItem[]>('/api/products/history');
  },

  getAnalysis(productId: string): Promise<AnalysisResponse> {
    return request<AnalysisResponse>('/api/products/' + encodeURIComponent(productId));
  },

  getMeta(): Promise<MetaResponse> {
    return request<MetaResponse>('/api/meta');
  },

  getVoiceSession(): Promise<VoiceSessionResponse> {
    return request<VoiceSessionResponse>('/api/voice/session');
  },

  askVoiceQuery(payload: {
    text: string;
    language: 'en' | 'hi' | 'ta';
    context?: { productId?: string; page?: string };
  }): Promise<VoiceQueryResponse> {
    return request<VoiceQueryResponse>('/api/voice/query', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async signup(payload: {
    email: string;
    password: string;
    name: string;
  }): Promise<{ user: AuthUser }> {
    const result = await request<{ user: AuthUser; token?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (result.token) await saveNativeSessionToken(result.token);
    return result;
  },

  async login(payload: { email: string; password: string }): Promise<{ user: AuthUser }> {
    const result = await request<{ user: AuthUser; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (result.token) await saveNativeSessionToken(result.token);
    return result;
  },

  async loginWithGoogle(credential: string): Promise<{ user: AuthUser }> {
    const result = await request<{ user: AuthUser; token?: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    if (result.token) await saveNativeSessionToken(result.token);
    return result;
  },

  async logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' });
    await clearNativeSessionToken();
  },

  me(): Promise<{ user: AuthUser | null }> {
    return request('/api/auth/me');
  },

  completeOnboarding(payload: {
    storeName: string;
    storeCity: string;
    storeCategory: string;
  }): Promise<{ user: AuthUser }> {
    return request('/api/auth/onboarding', { method: 'POST', body: JSON.stringify(payload) });
  },

  billingPlan(): Promise<BillingPlan> {
    return request('/api/billing/plan');
  },

  createBillingOrder(): Promise<BillingOrder> {
    return request('/api/billing/order', { method: 'POST', body: '{}' });
  },

  verifyPayment(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ user: AuthUser }> {
    return request('/api/billing/verify', { method: 'POST', body: JSON.stringify(payload) });
  },
};
