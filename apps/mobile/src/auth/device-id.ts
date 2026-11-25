import { createUuid } from '@partner-os/sync-engine';
import type { SecureStoreApi } from './chunked-secure-storage';

const DEVICE_ID_KEY = 'device.id';

/** Stable id of this installation, used to tell apart writes of different devices. */
export async function getOrCreateDeviceId(storage: SecureStoreApi, fixed = ''): Promise<string> {
  if (fixed !== '') return fixed;
  const existing = await storage.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = createUuid();
  await storage.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}
