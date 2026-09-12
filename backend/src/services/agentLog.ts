/**
 * Timestamped per-platform agent log. One report run should be reconstructable
 * by grepping `[agent:amazon]`, `[agent:flipkart]`, and `[agent:snapdeal]`.
 */

export function agentLog(
  platformId: string,
  stage: string,
  details?: Record<string, unknown>,
): void {
  const stamp = new Date().toISOString();
  const extra =
    details && Object.keys(details).length > 0 ? ' ' + safeJson(details) : '';
  console.log('[bodha-ai ' + stamp + '] [agent:' + platformId + '] ' + stage + extra);
}

export function agentWarn(
  platformId: string,
  stage: string,
  details?: Record<string, unknown>,
): void {
  const stamp = new Date().toISOString();
  const extra =
    details && Object.keys(details).length > 0 ? ' ' + safeJson(details) : '';
  console.warn('[bodha-ai ' + stamp + '] [agent:' + platformId + '] ' + stage + extra);
}

function safeJson(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
