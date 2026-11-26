import type { Attendance } from '../schemas/attendance.schema';

export type AttendanceEvent =
  | { type: 'attendance.created'; attendance: Attendance; occurredAt: string }
  | { type: 'attendance.updated'; attendance: Attendance; occurredAt: string }
  | {
      type: 'attendance.deleted';
      attendanceId: string;
      tenantId: string;
      occurredAt: string;
    };

export function attendanceCreated(
  attendance: Attendance,
  occurredAt = new Date().toISOString(),
): AttendanceEvent {
  return { type: 'attendance.created', attendance, occurredAt };
}

export function attendanceUpdated(
  attendance: Attendance,
  occurredAt = new Date().toISOString(),
): AttendanceEvent {
  return { type: 'attendance.updated', attendance, occurredAt };
}