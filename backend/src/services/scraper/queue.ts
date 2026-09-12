/**
 * One-at-a-time queue per marketplace. Concurrent scrapes against the same
 * host are the fastest way to earn a block; different platforms may overlap.
 */

type QueueTask<T> = () => Promise<T>;

interface QueueState {
  tail: Promise<unknown>;
}

const queues = new Map<string, QueueState>();

export function enqueueForPlatform<T>(platformId: string, task: QueueTask<T>): Promise<T> {
  const state = queues.get(platformId) ?? { tail: Promise.resolve() };
  const run = state.tail.then(task, task);
  state.tail = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(platformId, state);
  return run;
}
