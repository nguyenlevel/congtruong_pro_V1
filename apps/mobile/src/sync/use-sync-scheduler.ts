import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createSyncScheduler, type SyncScheduler, type SyncSchedulerStatus } from '@partner-os/sync-engine';

const PERIODIC_SYNC_MS = 5 * 60 * 1000;

const isOnline = (state: Network.NetworkState): boolean =>
  Boolean(state.isConnected) && state.isInternetReachable !== false;

const IDLE: SyncSchedulerStatus = {
  state: 'idle',
  consecutiveFailures: 0,
  lastError: null,
  lastSuccessAt: null,
  nextRetryAt: null,
};

export interface SyncControl {
  status: SyncSchedulerStatus;
  online: boolean;
  /** Runs a sync pass now (user action). Safe to call while one is running. */
  requestSync(): void;
}

/**
 * Keeps data in sync: on start, when the connection returns, when the app comes to the foreground,
 * every few minutes, and with backoff retries after a failure. Pass null while signed out.
 */
export function useSyncScheduler(syncNow: (() => Promise<void>) | null): SyncControl {
  const [status, setStatus] = useState<SyncSchedulerStatus>(IDLE);
  const [online, setOnline] = useState(true);
  const schedulerRef = useRef<SyncScheduler | null>(null);

  useEffect(() => {
    if (!syncNow) {
      schedulerRef.current = null;
      setStatus(IDLE);
      return;
    }
    const scheduler = createSyncScheduler({ run: syncNow });
    schedulerRef.current = scheduler;
    const unsubscribe = scheduler.subscribe(setStatus);
    const trigger = (): void => {
      void scheduler.request();
    };

    let wasOnline = false;
    void Network.getNetworkStateAsync().then((state) => {
      wasOnline = isOnline(state);
      setOnline(wasOnline);
      if (wasOnline) trigger();
    });
    const networkSubscription = Network.addNetworkStateListener((state) => {
      const now = isOnline(state);
      setOnline(now);
      if (now && !wasOnline) trigger();
      wasOnline = now;
    });
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && wasOnline) trigger();
    });
    const interval = setInterval(() => {
      if (wasOnline) trigger();
    }, PERIODIC_SYNC_MS);

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      networkSubscription.remove();
      unsubscribe();
      scheduler.stop();
      schedulerRef.current = null;
    };
  }, [syncNow]);

  const requestSync = useCallback(() => {
    void schedulerRef.current?.request();
  }, []);

  return { status, online, requestSync };
}
