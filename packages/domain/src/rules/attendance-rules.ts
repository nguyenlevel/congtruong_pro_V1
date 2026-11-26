import { InvalidStateError } from '../errors';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../enums/attendance-status';

const WORK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A work date must be a real calendar date (YYYY-MM-DD). */
export function isValidWorkDate(value: string): boolean {
  if (!WORK_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

export function requireValidWorkDate(value: string): void {
  if (!isValidWorkDate(value)) {
    throw new InvalidStateError(`Invalid work date: ${value}`, { value });
  }
}

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export function requireValidAttendanceStatus(value: string): AttendanceStatus {
  if (!isAttendanceStatus(value)) {
    throw new InvalidStateError(`Invalid attendance status: ${value}`, { value });
  }
  return value;
}

/**
 * A record cannot claim a check-out earlier than its check-in.
 * When only one of the two is present the record is incomplete but valid.
 */
export function requireCheckOutAfterCheckIn(checkInAt: string | null, checkOutAt: string | null): void {
  if (checkInAt !== null && checkOutAt !== null && checkOutAt < checkInAt) {
    throw new InvalidStateError('checkOutAt must be after checkInAt', { checkInAt, checkOutAt });
  }
}