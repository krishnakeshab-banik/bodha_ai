import { describe, expect, it } from 'vitest';

import { sharedBrowserErrorSignal } from '../services/scraper/errors.js';
import { classifySearchFailure, detectBlockedSignal } from '../services/scraper/pageState.js';

describe('classifySearchFailure', () => {
  it('classifies a Download is starting interstitial as BLOCKED, not TIMEOUT', () => {
    const page = {
      url: 'https://www.amazon.in/s?k=usb+c+cable',
      title: 'Amazon.in',
      body: 'Download is starting. Your download will start in a few seconds.',
      httpStatus: 200,
    };

    expect(detectBlockedSignal(page)).toBe('body:download-interstitial');
    expect(classifySearchFailure(page, { navigationTimedOut: true })).toEqual({
      kind: 'BLOCKED',
      signal: 'body:download-interstitial',
    });
  });

  it('classifies a CAPTCHA / sorry redirect as BLOCKED', () => {
    const page = {
      url: 'https://www.amazon.in/errors/validateCaptcha?amzn=1',
      title: 'Amazon.in',
      body: 'Enter the characters you see below',
      httpStatus: 200,
    };

    const result = classifySearchFailure(page, { navigationTimedOut: true });
    expect(result.kind).toBe('BLOCKED');
    expect(result.signal).toMatch(/captcha|bot-check|sorry/i);
  });

  it('classifies a robot-check title as BLOCKED', () => {
    expect(
      classifySearchFailure({
        url: 'https://www.amazon.in/s?k=cable',
        title: 'Robot Check',
        body: 'To discuss automated access to Amazon data please contact',
      }).kind,
    ).toBe('BLOCKED');
  });

  it('classifies a true navigation timeout with no blocked signals as TIMEOUT', () => {
    const result = classifySearchFailure(
      {
        url: 'about:blank',
        title: '',
        body: '',
        httpStatus: null,
      },
      { navigationTimedOut: true },
    );
    expect(result).toEqual({ kind: 'TIMEOUT' });
  });

  it('classifies HTTP 404 as NOT_FOUND', () => {
    expect(
      classifySearchFailure({
        url: 'https://www.amazon.in/s?k=nope',
        title: 'Page Not Found',
        body: 'The page you requested cannot be found',
        httpStatus: 404,
      }),
    ).toEqual({ kind: 'NOT_FOUND', signal: 'http:404' });
  });

  it('classifies a missing results grid on an otherwise normal page as NOT_FOUND', () => {
    const result = classifySearchFailure(
      {
        url: 'https://www.amazon.in/s?k=usb',
        title: 'Amazon.in: USB',
        body: 'Shop by category. Conditions of Use. Privacy Notice.',
        httpStatus: 200,
      },
      { selectorTimedOut: true },
    );
    expect(result).toEqual({ kind: 'NOT_FOUND', signal: 'selector-missing' });
  });

  it('does not treat a robots.txt footer mention as a bot-check', () => {
    expect(
      detectBlockedSignal({
        url: 'https://www.amazon.in/s?k=usb',
        title: 'Amazon.in: USB C Cable',
        body: 'See our robots.txt for details. Conditions of Use.',
      }),
    ).toBeNull();
  });

  it('does not treat a normal Amazon SERP app-download CTA as BLOCKED', () => {
    expect(
      detectBlockedSignal({
        url: 'https://www.amazon.in/s?k=USB+C+Fast+Charging+Cable',
        title: 'Amazon.in: USB C Fast Charging Cable',
        body:
          'Results. USB C Fast Charging Cable. Download the Amazon App. ' +
          'Click here to download the shopping app. See our robots.txt.',
        httpStatus: 200,
        challengeVisible: 0,
      }),
    ).toBeNull();
  });

  it('tags a shared Chromium launch failure so it is not a silent sibling TIMEOUT', () => {
    expect(
      sharedBrowserErrorSignal(
        new Error(
          "browserType.launch: Executable doesn't exist at C:\\fake\\chrome-headless-shell.exe",
        ),
      ),
    ).toBe('shared-browser-launch');
    expect(sharedBrowserErrorSignal(new Error('net::ERR_CONNECTION_RESET'))).toBeNull();
  });

  it('does not treat a Flipkart search page with a Download App link as BLOCKED', () => {
    expect(
      detectBlockedSignal({
        url: 'https://www.flipkart.com/search?q=USB+C+Fast+Charging+Cable',
        title: 'USB C Fast Charging Cable- Buy Products Online at Best Price in India - Flipkart',
        body: 'Download App Become a Seller Cart. USB C Fast Charging Cable ₹198',
        httpStatus: 200,
        challengeVisible: 0,
      }),
    ).toBeNull();
  });
});
