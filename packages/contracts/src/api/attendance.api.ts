import type { Attendance } from '../schemas/attendance.schema';
import type {
  AttendanceListQuery,
  CreateAttendanceInput,
  UpdateAttendanceInput,
} from '../dto/attendance.dto';

/**
 * The boundary contract the Web and Mobile clients agree on when talking
 * to the application service / repository layer for attendance records.
 */
export interface AttendanceApi {
  list(query: AttendanceListQuery): Promise<Attendance[]>;
  findById(id: string): Promise<Attendance | null>;
  create(input: CreateAttendanceInput): Promise<Attendance>;
  update(id: string, patch: UpdateAttendanceInput): Promise<Attendance>;
  remove(id: string): Promise<{ id: string; deletedAt: string }>;
}