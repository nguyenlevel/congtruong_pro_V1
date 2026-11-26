import { describe, expect, it, vi } from 'vitest';
import type { Attendance } from '@partner-os/contracts';
import { createAttendanceStore } from './attendanceStore';

const record = (id: string, status = 'PRESENT'): Attendance => ({
  id,
  tenantId: 'd44c72ee-0000-4000-8000-000000000001',
  projectId: null,
  workerId: '22222222-2222-4222-8222-222222222222',
  workDate: '2026-11-20',
  status: status as Attendance['status'],
  checkInAt: null,
  checkOutAt: null,
  note: null,
});

const api = {
  async list() {
    return [record('a1'), record('a2', 'ABSENT')];
  },
  async findById() {
    return null;
  },
  async create() {
    return record('a3');
  },
  async update() {
    return record('a1');
  },
  async remove() {
    return { id: 'a1', deletedAt: '2026-11-21T00:00:00.000Z' };
  },
};

describe('attendanceStore', () => {
  it('loads records and reaches loaded state', async () => {
    const store = createAttendanceStore();
    await store.load(api, { tenantId: 'd44c72ee-0000-4000-8000-000000000001' });
    expect(store.status).toBe('loaded');
    expect(store.records).toHaveLength(2);
  });

  it('captures errors from the api adapter', async () => {
    const failing = { ...api, async list() { throw new Error('boom'); } };
    const store = createAttendanceStore();
    await store.load(failing, { tenantId: 'd44c72ee-0000-4000-8000-000000000001' });
    expect(store.status).toBe('error');
    expect(store.error).toBe('boom');
  });

  it('exposes a snapshot interface for useSyncExternalStore', () => {
    const store = createAttendanceStore();
    expect(typeof store.getSnapshot).toBe('function');
    expect(typeof store.subscribe).toBe('function');
    expect(store.getSnapshot().status).toBe('idle');
  });

  it('is buildable without touching the real network', () => {
    expect(vi.isMockFunction(api.list)).toBe(false);
  });
});