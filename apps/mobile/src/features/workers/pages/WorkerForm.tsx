import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WorkerRepository } from '@partner-os/database';
import { translate } from '@partner-os/i18n';
import { colors, spacing, typography } from '@partner-os/ui';
import { createWorkerOffline } from '../services/offline-worker';

export interface WorkerFormProps {
  repository: WorkerRepository;
  tenantId: string;
  onCreated(): void;
}

/** Creates a worker on the device (works offline); the outbox pushes it when the network is back. */
export function WorkerForm({ repository, tenantId, onCreated }: WorkerFormProps): React.JSX.Element {
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      await createWorkerOffline(repository, {
        tenantId,
        projectId: null,
        code: code.trim().toUpperCase(),
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      setCode('');
      setFullName('');
      setPhoneNumber('');
      setMessage({ kind: 'ok', text: translate('vi', 'workerForm.saved') });
      onCreated();
    } catch (unexpected) {
      const detail = unexpected instanceof Error ? unexpected.message : String(unexpected);
      setMessage({ kind: 'error', text: `${translate('vi', 'workerForm.invalid')} ${detail}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container} accessibilityLabel={translate('vi', 'workerForm.add')}>
      <Text style={styles.title}>{translate('vi', 'workerForm.add')}</Text>
      <TextInput
        style={styles.input}
        placeholder={translate('vi', 'workerForm.code')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
        editable={!saving}
      />
      <TextInput
        style={styles.input}
        placeholder={translate('vi', 'workerForm.fullName')}
        value={fullName}
        onChangeText={setFullName}
        editable={!saving}
      />
      <TextInput
        style={styles.input}
        placeholder={translate('vi', 'workerForm.phone')}
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        editable={!saving}
      />
      <Pressable
        accessibilityRole="button"
        style={[styles.button, saving && styles.buttonDisabled]}
        disabled={saving}
        onPress={() => void submit()}
      >
        <Text style={styles.buttonText}>{translate('vi', 'workerForm.submit')}</Text>
      </Pressable>
      {message && (
        <Text style={message.kind === 'ok' ? styles.ok : styles.error}>{message.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.md },
  title: { fontWeight: typography.weight.bold, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 6,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.neutral.white },
  ok: { color: colors.success.DEFAULT, marginTop: spacing.sm, fontSize: typography.size.sm },
  error: { color: colors.danger.DEFAULT, marginTop: spacing.sm, fontSize: typography.size.sm },
});
