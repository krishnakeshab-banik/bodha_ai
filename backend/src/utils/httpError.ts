/**
 * Structured HTTP errors. Every failure leaving the API has the same JSON
 * shape: { error: { code, message, details? } }.
 */

export type ErrorCode =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'UNAUTHORIZED' | 'PAYMENT_REQUIRED';

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }

  static notFound(message: string): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static unauthorized(message = 'Please sign in to continue'): HttpError {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static paymentRequired(message: string, details?: unknown): HttpError {
    return new HttpError(402, 'PAYMENT_REQUIRED', message, details);
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}
