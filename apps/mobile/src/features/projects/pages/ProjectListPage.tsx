import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { colors, spacing, typography } from '@partner-os/ui';
import { listVisibleProjects, type ProjectSummary } from '../services/project-read';

export interface ProjectListPageProps {
  client: SupabaseClient;
}

type LoadState = 'loading' | 'loaded' | 'error';

/** Read-only project list for VS-01. Visibility is decided by RLS. No create, edit or delete actions. */
export function ProjectListPage({ client }: ProjectListPageProps): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    void listVisibleProjects(client)
      .then((rows) => {
        if (!active) return;
        setProjects(rows);
        setLoadState('loaded');
      })
      .catch((unexpected: unknown) => {
        if (!active) return;
        setError(unexpected instanceof Error ? unexpected.message : String(unexpected));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [client]);

  return (
    <ScrollView style={styles.container} testID="project-list">
      <Text style={styles.title}>Dự án</Text>

      {loadState === 'loading' && (
        <Text style={styles.subtitle} testID="project-list-loading">
          Đang tải dự án...
        </Text>
      )}
      {loadState === 'error' && (
        <Text style={styles.error} testID="project-list-error">
          Không tải được dự án: {error}
        </Text>
      )}
      {loadState === 'loaded' && projects.length === 0 && (
        <Text style={styles.subtitle} testID="project-list-empty">
          Chưa có dự án nào trong đơn vị này.
        </Text>
      )}
      {loadState === 'loaded' &&
        projects.map((project) => (
          <View key={project.id} style={styles.row}>
            <Text style={styles.name}>{project.siteName}</Text>
            <Text style={styles.muted}>
              {project.status}
            </Text>
          </View>
        ))}
    </ScrollView>
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
  row: {
    marginTop: spacing.sm,
  },
  name: {
    fontSize: typography.size.md,
  },
  muted: {
    fontSize: typography.size.xs,
    color: colors.neutral.gray,
  },
});
