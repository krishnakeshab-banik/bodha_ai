export class ScraperError extends Error {
  readonly code:
    | 'blocked'
    | 'timeout'
    | 'selector-not-found'
    | 'empty-results'
    | 'robots-disallowed'
    | 'unsupported-platform'
    | 'unknown';

  constructor(
    code: ScraperError['code'],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ScraperError';
    this.code = code;
  }
}

export function isScraperError(error: unknown): error is ScraperError {
  return error instanceof ScraperError;
}
