/** Small randomised pauses so successive Playwright actions look less bursty. */

export function randomDelay(minMs = 400, maxMs = 1200): Promise<void> {
  const span = Math.max(0, maxMs - minMs);
  const wait = minMs + Math.floor(Math.random() * (span + 1));
  return new Promise((resolve) => setTimeout(resolve, wait));
}
