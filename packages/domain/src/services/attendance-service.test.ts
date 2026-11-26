import { describe, expect, it } from 'vitest';
import {
  isValidWorkDate,
  requireCheckOutAfterCheckIn,
  requireValidAttendanceStatus,
  requireValidWorkDate,
} from '../rules/attendance-rules';
import { DomainError, InvalidStateError } from '../errors';
import { correctAttendanceStatus, validateAttendanceRecord } from '../services/attendance-service';
import type { Attendance } from '../entities/Attendance';

const base: Attendance = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'd44c72ee-0000-4000-8000-000000000001',
  projectId: null,
  workerId: '22222222-2222-4222-8222-222222222222',
  workDate: '2026-11-20',
  status: 'PRESENT',
  checkInAt: null,
  checkOutAt: null,
  note: null,
};

describe('attendance rules', () => {
  it('accepts a real calendar date', () => {
    expect(isValidWorkDate('2026-11-20')).toBe(true);
    expect(isValidWorkDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidWorkDate('2026-13-01')).toBe(false);
    expect(isValidWorkDate('2026-02-30')).toBe(false);
    expect(isValidWorkDate('2026-1-1')).toBe(false);
    expect(isValidWorkDate('nope')).toBe(false);
  });

  it('requireValidWorkDate throws for invalid dates', () => {
    expect(() => requireValidWorkDate('2026-13-01')).toThrow(InvalidStateError);
  });

  it('accepts only known attendance statuses', () => {
    expect(requireValidAttendanceStatus('PRESENT')).toBe('PRESENT');
    expect(requireValidAttendanceStatus('HALF_DAY')).toBe('HALF_DAY');
    expect(() => requireValidAttendanceStatus('BOGUS')).toThrow(InvalidStateError);
  });

  it('rejects a check-out earlier than the check-in', () => {
    expect(() =>
      requireCheckOutAfterCheckIn('2026-11-20T08:00:00.000Z', '2026-11-20T07:00:00.000Z'),
    ).toThrow(InvalidStateError);
    expect(() =>
      requireCheckOutAfterCheckIn('2026-11-20T08:00:00.000Z', '2026-11-20T09:00:00.000Z'),
    ).not.toThrow();
  });
});

describe('attendance service', () => {
  it('validates a well-formed record', () => {
    expect(validateAttendanceRecord(base).status).toBe('PRESENT');
  });

  it('rejects a note longer than 500 characters', () => {
    const error = () =>
      validateAttendanceRecord({ ...base, note: 'x'.repeat(501) });
    expect(error).toThrow(DomainError);
    expect(error).toThrow(/500 characters/);
  });

  it('corrects the status of a record', () => {
    const corrected = correctAttendanceStatus(base, 'ABSENT');
    expect(corrected.status).toBe('ABSENT');
    expect(corrected.id).toBe(base.id);
  });

  it('rejects an unknown status on correction', () => {
    expect(() => correctAttendanceStatus(base, 'BOGUS' as Attendance['status'])).toThrow(
      InvalidStateError,
    );
  });
});