import type { Attendance } from '../entities/Attendance';
import { DomainError, EntityNotFoundError } from '../errors';
import {
  requireCheckOutAfterCheckIn,
  requireValidAttendanceStatus,
  requireValidWorkDate,
} from '../rules/attendance-rules';

/**
 * Domain service: guards an attendance record against breaking core business
 * rules. Independent of any framework, database or UI.
 */
export function validateAttendanceRecord(attendance: Attendance): Attendance {
  requireValidWorkDate(attendance.workDate);
  requireValidAttendanceStatus(attendance.status);
  requireCheckOutAfterCheckIn(attendance.checkInAt, attendance.checkOutAt);
  if (attendance.note !== null && attendance.note !== undefined && attendance.note.length > 500) {
    throw new DomainError('NOTE_TOO_LONG', 'attendance note must be at most 500 characters');
  }
  return attendance;
}

export function requireAttendanceExists(attendance: Attendance | null, attendanceId: string): Attendance {
  if (!attendance) {
    throw new EntityNotFoundError('Attendance', attendanceId);
  }
  return attendance;
}

export function assertSameTenant(attendanceTenantId: string, tenantId: string): void {
  if (attendanceTenantId !== tenantId) {
    throw new DomainError('TENANT_MISMATCH', 'Attendance does not belong to the current tenant', {
      expectedTenantId: tenantId,
    });
  }
}

/** Apply a corrected status to an attendance record. Pure domain operation. */
export function correctAttendanceStatus(attendance: Attendance, nextStatus: Attendance['status']): Attendance {
  requireValidAttendanceStatus(nextStatus);
  return { ...attendance, status: nextStatus };
}