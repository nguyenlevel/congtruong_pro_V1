import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { colors, spacing, typography } from '@partner-os/ui';
import type { LocalSyncOutboxStore } from '../database';
import type { TenantMembership } from './memberships';
import { switchActiveTenant, UnsyncedBlockError } from './tenant-switch';

export interface TenantSwitcherProps {
  client: SupabaseClient;
  outbox: LocalSyncOutboxStore;
  tenants: TenantMembership[];
  activeTenantId: string | null;
  onSwitched: (tenantId: string) => void;
  /** Runs one sync pass; used once to drain the outbox before retrying a blocked switch. */
  onSyncNow: () => Promise<void>;
}

/**
 * Shows the current tenant. A single-tenant user sees a label only.
 * A failed or blocked switch keeps the current tenant and explains why.
 */
export function TenantSwitcher({
  client,
  outbox,
  tenants,
  activeTenantId,
  onSwitched,
  onSyncNow,
}: TenantSwitcherProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeName = tenants.find((tenant) => tenant.tenantId === activeTenantId)?.name ?? '—';

  async function attemptSwitch(tenantId: string): Promise<void> {
    try {
      await switchActiveTenant(client, outbox, tenantId);
      onSwitched(tenantId);
      setMessage(null);
      return;
    } catch (unexpected) {
      if (!(unexpected instanceof UnsyncedBlockError)) throw unexpected;
      await onSyncNow().catch(() => undefined);
      const after = await outbox.countUnsynced();
      if (after.total === 0) {
        await switchActiveTenant(client, outbox, tenantId);
        onSwitched(tenantId);
        setMessage(null);
        return;
      }
      setMessage(
        `Còn ${after.total} bản ghi chưa đồng bộ (chờ: ${after.pending}, lỗi: ${after.failed}). ` +
          'Đồng bộ xong rồi mới đổi đơn vị. Đơn vị hiện tại được giữ nguyên.',
      );
    }
  }

  async function choose(tenantId: string): Promise<void> {
    if (busy || tenantId === activeTenantId) return;
    setBusy(true);
    try {
      await attemptSwitch(tenantId);
    } catch (unexpected) {
      setMessage(unexpected instanceof Error ? unexpected.message : String(unexpected));
    } finally {
      setBusy(false);
    }
  }

  if (tenants.length <= 1) {
    return <Text style={styles.label}>Đơn vị: {activeName}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Đơn vị hiện tại: {activeName}</Text>
      {tenants.map((tenant) => {
        const isActive = tenant.tenantId === activeTenantId;
        return (
          <Pressable
            key={tenant.tenantId}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: busy }}
            disabled={busy || isActive}
            onPress={() => void choose(tenant.tenantId)}
            style={[styles.option, isActive && styles.optionActive]}
          >
            <Text style={isActive ? styles.optionActiveText : undefined}>
              {tenant.name}
              {isActive ? ' (đang dùng)' : ''}
            </Text>
          </Pressable>
        );
      })}
      {message && <Text style={styles.error}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.neutral.gray,
    marginTop: spacing.sm,
  },
  option: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.gray,
    borderRadius: 6,
  },
  optionActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: colors.neutral.white,
  },
  optionActiveText: {
    color: colors.primary.DEFAULT,
    fontWeight: typography.weight.bold,
  },
  error: {
    fontSize: typography.size.sm,
    color: colors.danger.DEFAULT,
    marginTop: spacing.sm,
  },
});
