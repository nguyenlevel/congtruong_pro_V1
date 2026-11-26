import type { AttendanceStatus } from '../enums/attendance-status';

/**
 * Domain entity: a worker's attendance on a work day.
 * Framework-free. Multi-tenant via `tenantId`, worker-scoped via `workerId`,
 * optionally site-scoped via `projectId`.
 */
export interface Attendance {
  id: string;
  tenantId: string;
  projectId: string | null;
  workerId: string;
  /** ISO date (YYYY-MM-DD) — the work day this record refers to. */
  workDate: string;
  status: AttendanceStatus;
  /** ISO datetime when the worker checked in/out, when recorded. */
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
}