import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Worker } from '@partner-os/domain';
import type { WorkerRepository } from '@partner-os/database';
import { translate } from '@partner-os/i18n';
import { colors, spacing, typography } from '@partner-os/ui';
import { WorkerForm } from './WorkerForm';

export interface WorkersListPageProps {
  repository: WorkerRepository | null;
  /** Active tenant from the database-verified membership; only this tenant's rows are shown. */
  tenantId: string | null;
  /** Shows the create form. A UI hint only: the database policies decide who may write. */
  canCreate?: boolean;
  /** Changes when local data changed elsewhere (for example a conflict was settled). */
  reloadKey?: number;
}

/**
 * Offline-first worker list. Reads from the local WorkerRepository
 * (WatermelonDB-backed once mobile wiring lands). When no repository is wired
 * yet, it states so instead of pretending to be connected.
 */
export function WorkersListPage({
  repository,
  tenantId,
  canCreate = false,
  reloadKey = 0,
}: WorkersListPageProps): React.JSX.Element {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localReload, setLocalReload] = useState(0);

  useEffect(() => {
    if (!repository) {
      setLoadState('error');
      setError('Local database adapter is not wired yet.');
      return;
    }
    if (!tenantId) {
      setWorkers([]);
      setLoadState('loaded');
      return;
    }
    setLoadState('loading');
    void repository
      .list({ tenantId })
      .then((rows) => {
        setWorkers(rows);
        setLoadState('loaded');
      })
      .catch((unexpected: unknown) => {
        const message = unexpected instanceof Error ? unexpected.message : String(unexpected);
        setError(message);
        setLoadState('error');
      });
  }, [repository, tenantId, reloadKey, localReload]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate('vi', 'nav.workers')}</Text>

      {canCreate && repository && tenantId && (
        <WorkerForm
          repository={repository}
          tenantId={tenantId}
          onCreated={() => setLocalReload((value) => value + 1)}
        />
      )}

      {loadState === 'loading' && <Text>{translate('vi', 'common.loading')}</Text>}
      {loadState === 'error' && (
        <Text style={styles.error}>{error ?? translate('vi', 'common.error')}</Text>
      )}
      {loadState === 'loaded' && workers.length === 0 && (
        <Text style={styles.subtitle}>{translate('vi', 'common.empty')}</Text>
      )}
      {loadState === 'loaded' &&
        workers.map((worker) => (
          <View key={worker.id} style={styles.row}>
            <Text>{worker.fullName}</Text>
            <Text style={styles.muted}>
              ({worker.code}) {worker.status}
            </Text>
          </View>
        ))}

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
