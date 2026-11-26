import { create } from 'zustand';
import type { Attendance, AttendanceApi, AttendanceListQuery } from '@partner-os/contracts';
import { listAttendance } from '../services/attendance-application';

export interface AttendanceStore {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  records: Attendance[];
  error: string | null;
  load: (api: AttendanceApi, query: AttendanceListQuery) => Promise<void>;
}

export function createAttendanceStore(): AttendanceStore & {
  getSnapshot: () => AttendanceStore;
  subscribe: (listener: () => void) => () => void;
} {
  const internal = create<AttendanceStore>()((set) => ({
    status: 'idle',
    records: [],
    error: null,
    async load(api, query) {
      set({ status: 'loading', error: null });
      try {
        const records = await listAttendance(api, query);
        set({ status: 'loaded', records });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ status: 'error', records: [], error: message });
      }
    },
  }));

  return {
    get status() {
      return internal.getState().status;
    },
    get records() {
      return internal.getState().records;
    },
    get error() {
      return internal.getState().error;
    },
    getSnapshot: internal.getState,
    subscribe: internal.subscribe,
    async load(api, query) {
      await internal.getState().load(api, query);
    },
  };
}