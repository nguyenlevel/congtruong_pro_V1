import { describe, expect, it, vi } from 'vitest';
import { createSyncScheduler, type SyncSchedulerTimers } from './sync-scheduler';

function fakeTimers() {
  const pending: Array<{ id: number; callback: () => void; delayMs: number }> = [];
  let next = 1;
  const timers: SyncSchedulerTimers = {
    setTimeout(callback, delayMs) {
      const id = next++;
      pending.push({ id, callback, delayMs });
      return id;
    },
    clearTimeout(handle) {
      const index = pending.findIndex((entry) => entry.id === handle);
      if (index >= 0) pending.splice(index, 1);
    },
  };
  return { timers, pending };
}

const policy = { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 4000 };

describe('createSyncScheduler', () => {
  it('shares one in-flight pass between concurrent requests', async () => {
    const run = vi.fn(async () => undefined);
    const scheduler = createSyncScheduler({ run, timers: fakeTimers().timers });

    await Promise.all([scheduler.request(), scheduler.request()]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus()).toMatchObject({ state: 'idle', consecutiveFailures: 0 });
  });

  it('retries failed passes with capped exponential backoff and never gives up', async () => {
    const { timers, pending } = fakeTimers();
    const run = vi.fn(async () => {
      throw new Error('offline');
    });
    const scheduler = createSyncScheduler({ run, timers, policy, random: () => 0, now: () => 0 });

    await scheduler.request();
    expect(scheduler.getStatus()).toMatchObject({ state: 'waiting_retry', consecutiveFailures: 1, lastError: 'offline' });
    expect(pending.map((entry) => entry.delayMs)).toEqual([1000]);

    const delays: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const entry = pending.shift()!;
      entry.callback();
      await scheduler.request();
      delays.push(pending[0]!.delayMs);
    }

    expect(delays).toEqual([2000, 4000, 4000, 4000, 4000]);
    expect(run.mock.calls.length).toBeGreaterThan(5);
  });

  it('resets the failure count after a successful pass', async () => {
    const { timers, pending } = fakeTimers();
    let fail = true;
    const scheduler = createSyncScheduler({
      run: async () => {
        if (fail) throw new Error('offline');
      },
      timers,
      policy,
      random: () => 0,
      now: () => 42,
    });

    await scheduler.request();
    fail = false;
    pending.shift()!.callback();
    await scheduler.request();

    expect(scheduler.getStatus()).toEqual({
      state: 'idle',
      consecutiveFailures: 0,
      lastError: null,
      lastSuccessAt: 42,
      nextRetryAt: null,
    });
    expect(pending).toHaveLength(0);
  });

  it('stop() cancels the scheduled retry and ignores later requests', async () => {
    const { timers, pending } = fakeTimers();
    const run = vi.fn(async () => {
      throw new Error('offline');
    });
    const scheduler = createSyncScheduler({ run, timers, policy });

    await scheduler.request();
    scheduler.stop();
    await scheduler.request();

    expect(pending).toHaveLength(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers about status changes', async () => {
    const seen: string[] = [];
    const scheduler = createSyncScheduler({ run: async () => undefined, timers: fakeTimers().timers });
    scheduler.subscribe((status) => seen.push(status.state));

    await scheduler.request();

    expect(seen).toEqual(['syncing', 'idle']);
  });
});
