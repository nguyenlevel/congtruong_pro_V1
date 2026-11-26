import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_RETRY_POLICY } from '@partner-os/sync-engine';
import { translate } from '@partner-os/i18n';
import { colors, spacing, typography } from '@partner-os/ui';
import type { LocalConflictOutboxStore, LocalOutboxRecord, UnsyncedCount } from '../database';
import { canKeepMine, resolveConflict, retryExhausted, type ConflictResolutionDeps } from './conflict-resolution';
import type { SyncControl } from './use-sync-scheduler';

export interface SyncCenterProps {
  outbox: LocalConflictOutboxStore;
  tenantId: string;
  control: SyncControl;
  resolution: ConflictResolutionDeps;
  /** Called after a conflict is settled so lists can reload their local data. */
  onChanged(): void;
}

const EMPTY: UnsyncedCount = { pending: 0, failed: 0, conflict: 0, total: 0 };

function describeRecord(record: LocalOutboxRecord): string {
  try {
    const payload = JSON.parse(record.payload) as Record<string, unknown>;
    const label = payload.fullName ?? payload.code ?? payload.workDate ?? record.recordId;
    return `${record.recordType}: ${String(label)}`;
  } catch {
    return `${record.recordType}: ${record.recordId}`;
  }
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Sync status, manual sync, and the records that need a decision (conflicts) or a retry. */
export function SyncCenter({ outbox, tenantId, control, resolution, onChanged }: SyncCenterProps): React.JSX.Element {
  const [counts, setCounts] = useState<UnsyncedCount>(EMPTY);
  const [conflicts, setConflicts] = useState<LocalOutboxRecord[]>([]);
  const [exhausted, setExhausted] = useState<LocalOutboxRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextCounts, nextConflicts, nextExhausted] = await Promise.all([
      outbox.countUnsynced(tenantId),
      outbox.conflicts(tenantId),
      outbox.exhausted(DEFAULT_RETRY_POLICY.maxAttempts, tenantId),
    ]);
    setCounts(nextCounts);
    setConflicts(nextConflicts);
    setExhausted(nextExhausted);
  }, [outbox, tenantId]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh, control.status]);

  async function settle(record: LocalOutboxRecord, choice: 'keep_server' | 'keep_mine'): Promise<void> {
    setError(null);
    try {
      await resolveConflict(resolution, record, choice);
      await refresh();
      onChanged();
      control.requestSync();
    } catch (unexpected) {
      setError(unexpected instanceof Error ? unexpected.message : String(unexpected));
    }
  }

  async function retryAll(): Promise<void> {
    await retryExhausted(outbox, exhausted);
    await refresh();
    control.requestSync();
  }

  const statusLabel =
    control.status.state === 'syncing'
      ? translate('vi', 'sync.statusSyncing')
      : control.status.state === 'waiting_retry'
        ? translate('vi', 'sync.statusRetry')
        : translate('vi', 'sync.statusIdle');
  const lastSync = control.status.lastSuccessAt
    ? new Date(control.status.lastSuccessAt).toLocaleString()
    : translate('vi', 'sync.never');

  return (
    <View style={styles.container}>
      {!control.online && <Text style={styles.banner}>{translate('vi', 'sync.offlineBanner')}</Text>}
      <Text style={styles.status}>{statusLabel}</Text>
      <Text style={styles.muted}>
        {translate('vi', 'sync.lastSync')}: {lastSync}
      </Text>
      <Text style={styles.muted}>
        {translate('vi', 'sync.unsynced')}: {counts.total}
      </Text>
      <ActionButton label={translate('vi', 'sync.syncNow')} onPress={control.requestSync} />

      {exhausted.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {translate('vi', 'sync.failed')}: {exhausted.length}
          </Text>
          <ActionButton label={translate('vi', 'sync.retryFailed')} onPress={() => void retryAll()} />
        </View>
      )}

      {conflicts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {translate('vi', 'sync.conflicts')}: {conflicts.length}
          </Text>
          <Text style={styles.muted}>{translate('vi', 'sync.conflictHint')}</Text>
          {conflicts.map((record) => (
            <View key={record.operationId} style={styles.row}>
              <Text>{describeRecord(record)}</Text>
              <View style={styles.actions}>
                <ActionButton label={translate('vi', 'sync.keepServer')} onPress={() => void settle(record, 'keep_server')} />
                {canKeepMine(record) && (
                  <ActionButton label={translate('vi', 'sync.keepMine')} onPress={() => void settle(record, 'keep_mine')} />
                )}
              </View>
            </View>
          ))}
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  banner: { color: colors.danger.DEFAULT, fontSize: typography.size.sm, marginBottom: spacing.sm },
  status: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
  muted: { fontSize: typography.size.sm, color: colors.neutral.gray },
  section: { marginTop: spacing.md },
  sectionTitle: { fontWeight: typography.weight.bold },
  row: { marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  button: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary.DEFAULT,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonText: { color: colors.primary.DEFAULT },
  error: { color: colors.danger.DEFAULT, marginTop: spacing.sm, fontSize: typography.size.sm },
});
