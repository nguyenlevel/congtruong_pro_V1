import {
  AttendanceListQuery,
  CreateAttendanceInput,
  type Attendance,
  type AttendanceApi,
} from '@partner-os/contracts';

/**
 * Application use-cases for the attendance feature. Each input is validated
 * through the Zod boundary (contract section 7) before touching any adapter.
 */
export async function listAttendance(
  api: AttendanceApi,
  query: AttendanceListQuery,
): Promise<Attendance[]> {
  const parsed = AttendanceListQuery.parse(query);
  return api.list(parsed);
}

export async function createAttendance(
  api: AttendanceApi,
  input: CreateAttendanceInput,
): Promise<Attendance> {
  const parsed = CreateAttendanceInput.parse(input);
  return api.create(parsed);
}