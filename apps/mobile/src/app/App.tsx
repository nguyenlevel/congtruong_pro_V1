import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { canWriteRoster } from '@partner-os/auth';
import { translate } from '@partner-os/i18n';
import { colors, spacing, typography } from '@partner-os/ui';
import { createLocalWorkerRepository, WorkersListPage } from '../features/workers';
import { createLocalAttendanceRepository, AttendanceListPage } from '../features/attendance';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { createWatermelonDatabase } from '../database';
import { readMobileEnv } from '../shared/config/env';
import { createChunkedSecureStorage } from '../auth/chunked-secure-storage';
import {
  bindAutoRefresh,
  createMobileSupabaseClient,
  signInWithPassword,
  signOut,
  useSession,
} from '../auth/session';
import { resolveAccess, type AccessResult } from '../auth/access';
import { getOrCreateDeviceId } from '../auth/device-id';
import { prepareLocalData } from '../auth/local-owner';
import { performLogout, planLogout } from '../auth/logout';
import { createSupabaseSyncTransport } from '../sync/supabase-sync-transport';
import { createSupabaseAttendanceTransport } from '../sync/supabase-attendance-transport';
import { createWorkerSyncRuntime, createAttendanceSyncRuntime } from '../sync/sync-runtime';
import { clearCursors, createSecureCursorStore } from '../sync/secure-cursor-store';
import { useSyncScheduler } from '../sync/use-sync-scheduler';
import { createAttendanceAdapter, createWorkerAdapter } from '../sync/conflict-resolution';
import { SyncCenter } from '../sync/SyncCenter';
import { TenantSwitcher } from '../auth/TenantSwitcher';
import { ProjectListPage } from '../features/projects';

const mobileEnv = readMobileEnv({
  EXPO_PUBLIC_DEVICE_ID: process.env.EXPO_PUBLIC_DEVICE_ID,
  EXPO_PUBLIC_FEATURE_ATTENDANCE: process.env.EXPO_PUBLIC_FEATURE_ATTENDANCE,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
});
const localDatabase = createWatermelonDatabase();

const isConfigured = mobileEnv.supabaseUrl !== '' && mobileEnv.supabaseAnonKey !== '';
const supabase = isConfigured
  ? createMobileSupabaseClient(
      { supabaseUrl: mobileEnv.supabaseUrl, supabaseAnonKey: mobileEnv.supabaseAnonKey },
      createChunkedSecureStorage(SecureStore),
    )
  : null;
const syncOutbox = localDatabase.outbox;

async function deviceIsOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

type DeviceState = 'checking' | 'ready' | 'blocked';

export default function App(): React.JSX.Element {
  const session = useSession(supabase);
  const userId = session.status === 'signed-in' ? session.session.user.id : null;
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceState, setDeviceState] = useState<DeviceState>('checking');
  const [access, setAccess] = useState<AccessResult | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    void getOrCreateDeviceId(SecureStore, mobileEnv.deviceId).then(setDeviceId);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    return bindAutoRefresh(supabase);
  }, []);

  // The device database belongs to one user at a time; another user can take it over only when it is fully synced.
  useEffect(() => {
    if (!userId) {
      setDeviceState('checking');
      return;
    }
    let active = true;
    void prepareLocalData({
      storage: SecureStore,
      outbox: syncOutbox,
      userId,
      clearLocalData: localDatabase.clearAll,
      clearCursors: async () => undefined,
    }).then((result) => {
      if (active) setDeviceState(result);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId || deviceState !== 'ready') {
      setAccess(null);
      return;
    }
    let active = true;
    void resolveAccess({ client: supabase, storage: SecureStore, userId, isOnline: deviceIsOnline }).then(
      (result) => {
        if (active) setAccess(result);
      },
    );
    return () => {
      active = false;
    };
  }, [userId, deviceState]);

  const ready = access?.status === 'ready' ? access : null;
  const activeTenantId = ready?.activeTenantId ?? null;
  const tenants = ready?.tenants ?? [];
  const role = tenants.find((tenant) => tenant.tenantId === activeTenantId)?.role ?? null;

  const workerRepository = useMemo(
    () => (deviceId ? createLocalWorkerRepository(localDatabase, deviceId) : null),
    [deviceId],
  );
  const attendanceRepository = useMemo(
    () => (deviceId && mobileEnv.features.attendance ? createLocalAttendanceRepository(localDatabase, deviceId) : null),
    [deviceId],
  );

  const syncNow = useMemo(() => {
    if (!supabase || !activeTenantId) return null;
    const workerRuntime = createWorkerSyncRuntime({
      outbox: syncOutbox,
      workers: localDatabase.workers,
      transport: createSupabaseSyncTransport(supabase),
      cursorStore: createSecureCursorStore(SecureStore, activeTenantId, 'worker'),
    });
    const attendanceRuntime = mobileEnv.features.attendance
      ? createAttendanceSyncRuntime({
          outbox: syncOutbox,
          attendance: localDatabase.attendance,
          transport: createSupabaseAttendanceTransport(supabase),
          cursorStore: createSecureCursorStore(SecureStore, activeTenantId, 'attendance'),
        })
      : null;
    return async () => {
      await Promise.all([workerRuntime.syncNow(), attendanceRuntime?.syncNow()]);
    };
  }, [activeTenantId]);

  const control = useSyncScheduler(userId && syncNow ? syncNow : null);

  // Reload local lists after a sync pass brought changes.
  useEffect(() => {
    setDataVersion((value) => value + 1);
  }, [control.status.lastSuccessAt]);

  const resolution = useMemo(
    () => ({
      outbox: syncOutbox,
      adapters: {
        worker: createWorkerAdapter(localDatabase.workers),
        attendance: createAttendanceAdapter(localDatabase.attendance),
      },
    }),
    [],
  );

  const finishLogout = useCallback(async () => {
    if (!supabase) return;
    await performLogout({
      storage: SecureStore,
      outbox: syncOutbox,
      signOut: () => signOut(supabase),
      clearLocalData: localDatabase.clearAll,
      clearCursors: () => clearCursors(SecureStore, tenants.map((tenant) => tenant.tenantId)),
    });
  }, [tenants]);

  const requestLogout = useCallback(async () => {
    const plan = await planLogout(syncOutbox);
    if (!plan.requiresWarning) {
      await finishLogout();
      return;
    }
    Alert.alert(
      translate('vi', 'auth.logoutWarnTitle'),
      `${translate('vi', 'auth.logoutWarnBody')} (${plan.unsynced.total})`,
      [
        { text: translate('vi', 'actions.cancel'), style: 'cancel' },
        {
          text: translate('vi', 'auth.syncThenLogout'),
          onPress: () => {
            void (async () => {
              await syncNow?.().catch(() => undefined);
              await finishLogout();
            })();
          },
        },
        { text: translate('vi', 'auth.logoutAnyway'), style: 'destructive', onPress: () => void finishLogout() },
      ],
    );
  }, [finishLogout, syncNow]);

  if (!supabase) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Thiếu cấu hình EXPO_PUBLIC_SUPABASE_URL hoặc EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Text>
      </View>
    );
  }

  if (session.status === 'loading' || !deviceId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary.DEFAULT} />
      </View>
    );
  }

  if (session.status === 'signed-out') {
    return (
      <LoginPage onSignIn={(email, password) => signInWithPassword(supabase, email, password)} />
    );
  }

  if (deviceState === 'blocked') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{translate('vi', 'auth.deviceBusy')}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut(supabase)}>
          <Text style={styles.buttonText}>{translate('vi', 'auth.logout')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!access || !ready || !activeTenantId) {
    return (
      <View style={styles.center}>
        {access ? (
          <>
            <Text style={styles.message}>{access.status === 'ready' ? '' : access.reason}</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut(supabase)}>
              <Text style={styles.buttonText}>{translate('vi', 'auth.logout')}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary.DEFAULT} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen}>
      {ready.offline && <Text style={styles.banner}>{translate('vi', 'sync.offlineBanner')}</Text>}
      <View style={styles.header}>
        <TenantSwitcher
          client={supabase}
          outbox={syncOutbox}
          tenants={tenants}
          activeTenantId={activeTenantId}
          onSwitched={(tenantId) =>
            setAccess((current) =>
              current?.status === 'ready' ? { ...current, activeTenantId: tenantId } : current,
            )
          }
          onSyncNow={syncNow ?? (async () => undefined)}
        />
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void requestLogout()}>
          <Text style={styles.buttonText}>{translate('vi', 'auth.logout')}</Text>
        </Pressable>
      </View>
      <SyncCenter
        outbox={syncOutbox}
        tenantId={activeTenantId}
        control={control}
        resolution={resolution}
        onChanged={() => setDataVersion((value) => value + 1)}
      />
      {!ready.offline && <ProjectListPage client={supabase} />}
      <WorkersListPage
        repository={workerRepository}
        tenantId={activeTenantId}
        canCreate={canWriteRoster(role)}
        reloadKey={dataVersion}
      />
      {attendanceRepository && <AttendanceListPage repository={attendanceRepository} tenantId={activeTenantId} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  header: {
    padding: spacing.md,
  },
  banner: {
    backgroundColor: colors.warning.light,
    color: colors.warning.DEFAULT,
    padding: spacing.sm,
    fontSize: typography.size.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral.white,
  },
  message: {
    color: colors.neutral.gray,
    fontSize: typography.size.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary.DEFAULT,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: colors.primary.DEFAULT,
  },
});
