import type { Attendance } from '@partner-os/domain';
import type { ScopedRepository } from '../repository';

/**
 * Attendance persistence contract. Implementations:
 * - Web:    Supabase/PostgreSQL adapter (online-first)
 * - Mobile: WatermelonDB local adapter (offline-first)
 */
export interface AttendanceRepository extends ScopedRepository<Attendance, string, string> {
  listByWorker(workerId: string): Promise<Attendance[]>;
  listByWorkDate(workDate: string): Promise<Attendance[]>;
}