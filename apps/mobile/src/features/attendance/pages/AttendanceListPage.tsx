import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Attendance } from '@partner-os/domain';
import type { AttendanceRepository } from '@partner-os/database';
import { colors, spacing, typography } from '@partner-os/ui';
import { translate } from '@partner-os/i18n';

export interface AttendanceListPageProps {
  repository: AttendanceRepository | null;
  /** Active tenant from the database-verified membership; only this tenant's rows are shown. */
  tenantId: string | null;
}

function statusTone(status: Attendance['status']): { color: string; label: string } {
  switch (status) {
    case 'PRESENT':
      return { color: colors.success.DEFAULT, label: 'Có mặt' };
    case 'HALF_DAY':
      return { color: colors.warning.DEFAULT, label: 'Nửa ngày' };
    case 'ON_LEAVE':
      return { color: colors.warning.DEFAULT, label: 'Nghỉ phép' };
    default:
      return { color: colors.warning.DEFAULT, label: 'Vắng' };
  }
}

/**
 * Offline-first attendance list. Reads from the local AttendanceRepository
 * (WatermelonDB-backed once wired). When no repository is wired yet, it states
 * so instead of pretending to be connected.
 */
export function AttendanceListPage({
  repository,
  tenantId,
}: AttendanceListPageProps): React.JSX.Element {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repository) {
      setLoadState('error');
      setError('Local database adapter is not wired yet.');
      return;
    }
    if (!tenantId) {
      setRecords([]);
      setLoadState('loaded');
      return;
    }
    setLoadState('loading');
    void repository
      .listForScope(tenantId)
      .then((rows) => {
        setRecords(rows);
        setLoadState('loaded');
      })
      .catch((unexpected: unknown) => {
        const message = unexpected instanceof Error ? unexpected.message : String(unexpected);
        setError(message);
        setLoadState('error');
      });
  }, [repository, tenantId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate('vi', 'nav.attendance')}</Text>
      <Text style={styles.subtitle}>{translate('vi', 'common.offline')}</Text>

      {loadState === 'loading' && <Text>{translate('vi', 'common.loading')}</Text>}
      {loadState === 'error' && (
        <Text style={styles.error}>{error ?? translate('vi', 'common.error')}</Text>
      )}
      {loadState === 'loaded' && records.length === 0 && (
        <Text style={styles.subtitle}>{translate('vi', 'common.empty')}</Text>
      )}
      {loadState === 'loaded' &&
        records.map((record) => {
          const tone = statusTone(record.status);
          return (
            <View key={`${record.workerId}-${record.workDate}`} style={styles.row}>
              <Text>
                {record.workDate} · {tone.label}
              </Text>
              <Text style={styles.muted}>
                {record.workerId}
                {record.note ? ` · ${record.note}` : ''}
              </Text>
            </View>
          );
        })}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.neutral.light,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.primary.DEFAULT,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.neutral.gray,
    marginTop: spacing.sm,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger.DEFAULT,
    marginTop: spacing.md,
  },
  muted: {
    fontSize: typography.size.xs,
    color: colors.neutral.gray,
  },
  row: {
    marginTop: spacing.sm,
  },
});