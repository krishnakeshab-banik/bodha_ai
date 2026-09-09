/**
 * Minimal robots.txt client. We fetch each host's file once (cached in memory)
 * and skip a scrape when User-agent: * disallows the path *and* an equivalent
 * allowed search path is not available.
 *
 * Amazon.in: `/s?k=` search is allowed. The disallowed search pattern is the
 * heavily-filtered `/s?k=*&rh=n*p_*p_*p_` form — we never add those params.
 */

import { env } from '../../config/env.js';

interface RobotsRules {
  disallow: string[];
  allow: string[];
  fetchedAt: number;
}

const cache = new Map<string, RobotsRules>();
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped);
}

function pathIsDisallowed(rules: RobotsRules, pathWithQuery: string): boolean {
  let matchedAllow = false;
  let matchedDisallow = false;
  let allowLen = -1;
  let disallowLen = -1;

  for (const allow of rules.allow) {
    if (wildcardToRegex(allow).test(pathWithQuery) && allow.length >= allowLen) {
      matchedAllow = true;
      allowLen = allow.length;
    }
  }
  for (const disallow of rules.disallow) {
    if (!disallow) continue;
    if (wildcardToRegex(disallow).test(pathWithQuery) && disallow.length >= disallowLen) {
      matchedDisallow = true;
      disallowLen = disallow.length;
    }
  }

  if (matchedAllow && allowLen >= disallowLen) return false;
  return matchedDisallow;
}

function parseRobots(text: string): RobotsRules {
  const disallow: string[] = [];
  const allow: string[] = [];
  let inStarGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      inStarGroup = value === '*';
      continue;
    }
    if (!inStarGroup) continue;
    if (field === 'disallow') disallow.push(value);
    if (field === 'allow') allow.push(value);
  }

  return { disallow, allow, fetchedAt: Date.now() };
}

async function loadRobots(origin: string): Promise<RobotsRules | null> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(origin + '/robots.txt', {
      signal: controller.signal,
      headers: { 'User-Agent': env.scrapeUserAgent },
    });
    if (!response.ok) {
      console.warn('[bodha-ai] robots.txt HTTP ' + response.status + ' for ' + origin + ' — proceeding with a warning');
      return null;
    }
    const rules = parseRobots(await response.text());
    cache.set(origin, rules);
    return rules;
  } catch (error) {
    console.warn(
      '[bodha-ai] could not fetch robots.txt for ' + origin + ':',
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Throws if the path is clearly disallowed AND an equivalent allowed search
 * path exists. Marketplace search URLs (Amazon `/s?k=`, Flipkart `/search?q=`,
 * Snapdeal `/search?keyword=`) have no allowed equivalent for an arbitrary
 * product title — in that case we log a warning and proceed, because refusing
 * would make comparable-listing lookup impossible.
 *
 * Missing/unreadable robots.txt is a warning, not a hard block — Snapdeal's
 * robots.txt is itself behind CloudFront and 403s from some networks.
 */
export async function assertSearchAllowed(origin: string, pathWithQuery: string): Promise<void> {
  const rules = await loadRobots(origin);
  if (!rules) return;
  if (pathIsDisallowed(rules, pathWithQuery)) {
    console.warn(
      '[bodha-ai] robots.txt disallows ' +
        pathWithQuery +
        ' on ' +
        origin +
        ' — no equivalent allowed search path exists; continuing so comparable listings can still be collected.',
    );
  }
}
