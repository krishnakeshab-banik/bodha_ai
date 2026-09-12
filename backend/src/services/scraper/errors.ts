import type { ScrapeStatus } from './pageState.js';

export class ScraperError extends Error {
  readonly code:
    | 'blocked'
    | 'timeout'
    | 'not-found'
    | 'selector-not-found'
    | 'empty-results'
    | 'robots-disallowed'
    | 'unsupported-platform'
    | 'unknown';

  /** Which page signal produced a BLOCKED classification, when known. */
  readonly signal?: string;

  constructor(
    code: ScraperError['code'],
    message: string,
    readonly cause?: unknown,
    signal?: string,
  ) {
    super(message);
    this.name = 'ScraperError';
    this.code = code;
    this.signal = signal;
  }
}

export function sharedBrowserErrorSignal(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /browserType\.launch|Executable doesn't exist|Target closed|Browser has been closed|browser.*disconnected/i.test(
      message,
    )
  ) {
    return 'shared-browser-launch';
  }
  return null;
}

export function isScraperError(error: unknown): error is ScraperError {
  return error instanceof ScraperError;
}

/** Map a scraper failure onto the public BLOCKED / TIMEOUT / NOT_FOUND status. */
export function scrapeStatusFromError(error: unknown): ScrapeStatus | null {
  if (!isScraperError(error)) return null;
  if (error.code === 'blocked') return 'BLOCKED';
  if (error.code === 'timeout') return 'TIMEOUT';
  if (
    error.code === 'not-found' ||
    error.code === 'selector-not-found' ||
    error.code === 'empty-results'
  ) {
    return 'NOT_FOUND';
  }
  return null;
}

export function scraperErrorFromClassification(
  classification: { kind: ScrapeStatus; signal?: string },
  platformName: string,
  extraMessage?: string,
  cause?: unknown,
): ScraperError {
  if (classification.kind === 'BLOCKED') {
    return new ScraperError(
      'blocked',
      platformName +
        ' presented a blocked or interstitial page (' +
        (classification.signal ?? 'unknown-signal') +
        ') — falling back without retrying.',
      cause,
      classification.signal,
    );
  }
  if (classification.kind === 'TIMEOUT') {
    return new ScraperError(
      'timeout',
      extraMessage ?? 'Timed out loading ' + platformName + ' search results.',
      cause,
    );
  }
  return new ScraperError(
    'not-found',
    extraMessage ?? 'Could not find ' + platformName + ' search results.',
    cause,
    classification.signal,
  );
}
