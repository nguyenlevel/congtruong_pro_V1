import { delayForAttempt, type RetryPolicy } from '../retry/retry';

export type SyncSchedulerState = 'idle' | 'syncing' | 'waiting_retry';

export interface SyncSchedulerStatus {
  state: SyncSchedulerState;
  consecutiveFailures: number;
  lastError: string | null;
  lastSuccessAt: number | null;
  nextRetryAt: number | null;
}

export interface SyncSchedulerTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SyncSchedulerOptions {
  /** One full sync pass (push, then pull). A rejected promise counts as a failure. */
  run(): Promise<void>;
  /** Backoff between automatic retries. `maxAttempts` is ignored: retries continue until success or stop(). */
  policy?: RetryPolicy;
  timers?: SyncSchedulerTimers;
  now?(): number;
  /** Returns a value in [0, 1); adds up to 20% jitter so devices do not retry in lockstep. */
  random?(): number;
}

export interface SyncScheduler {
  /** Runs a sync pass now. Concurrent calls share the pass already in flight. */
  request(): Promise<void>;
  stop(): void;
  getStatus(): SyncSchedulerStatus;
  subscribe(listener: (status: SyncSchedulerStatus) => void): () => void;
}

const DEFAULT_POLICY: RetryPolicy = { maxAttempts: Number.MAX_SAFE_INTEGER, baseDelayMs: 2_000, maxDelayMs: 300_000 };

interface TimerGlobals {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

// The package compiles without DOM or Node typings; the runtime (Hermes, browsers, Node) provides the timers.
const DEFAULT_TIMERS: SyncSchedulerTimers = {
  setTimeout: (callback, delayMs) => (globalThis as unknown as TimerGlobals).setTimeout(callback, delayMs),
  clearTimeout: (handle) => (globalThis as unknown as TimerGlobals).clearTimeout(handle),
};

/**
 * Runs sync passes on demand and retries failed passes with capped exponential backoff.
 * It never drops pending work: the outbox is the source of truth, the scheduler only decides when to try.
 */
export function createSyncScheduler(options: SyncSchedulerOptions): SyncScheduler {
  const policy = options.policy ?? DEFAULT_POLICY;
  const timers = options.timers ?? DEFAULT_TIMERS;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const listeners = new Set<(status: SyncSchedulerStatus) => void>();

  let status: SyncSchedulerStatus = {
    state: 'idle',
    consecutiveFailures: 0,
    lastError: null,
    lastSuccessAt: null,
    nextRetryAt: null,
  };
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;

  function update(next: Partial<SyncSchedulerStatus>): void {
    status = { ...status, ...next };
    listeners.forEach((listener) => listener(status));
  }

  function clearTimer(): void {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  }

  async function pass(): Promise<void> {
    clearTimer();
    update({ state: 'syncing', nextRetryAt: null });
    try {
      await options.run();
      update({ state: 'idle', consecutiveFailures: 0, lastError: null, lastSuccessAt: now() });
    } catch (error) {
      const failures = status.consecutiveFailures + 1;
      const delay = Math.round(delayForAttempt(failures, policy) * (1 + random() * 0.2));
      update({
        state: stopped ? 'idle' : 'waiting_retry',
        consecutiveFailures: failures,
        lastError: error instanceof Error ? error.message : String(error),
        nextRetryAt: stopped ? null : now() + delay,
      });
      if (!stopped) {
        timer = timers.setTimeout(() => {
          timer = null;
          void request();
        }, delay);
      }
    }
  }

  function request(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (!inFlight) {
      inFlight = pass().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  return {
    request,
    stop() {
      stopped = true;
      clearTimer();
      update({ state: 'idle', nextRetryAt: null });
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
