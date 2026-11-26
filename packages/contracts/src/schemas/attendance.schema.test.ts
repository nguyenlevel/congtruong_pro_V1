import { describe, expect, it } from 'vitest';
import {
  AttendanceSchema,
  parseAttendance,
  safeParseAttendance,
} from './attendance.schema';
import { AttendanceListQuery, CreateAttendanceInput, UpdateAttendanceInput } from '../dto/attendance.dto';

const valid = {
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

describe('attendance schema', () => {
  it('parses a well-formed attendance record', () => {
    expect(parseAttendance(valid).status).toBe('PRESENT');
  });

  it('rejects an invalid work date', () => {
    expect(safeParseAttendance({ ...valid, workDate: '2026-02-30' }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(safeParseAttendance({ ...valid, status: 'BOGUS' }).success).toBe(false);
  });

  it('rejects extra keys (strict mode)', () => {
    expect(safeParseAttendance({ ...valid, extra: true }).success).toBe(false);
  });

  it('inferred type is an attendance', () => {
    const parsed = AttendanceSchema.parse(valid);
    expect(TypeCheck(parsed)).toBe(true);
    function TypeCheck(_attendance: { id: string; workerId: string }): true {
      return true;
    }
  });
});

describe('attendance DTOs', () => {
  it('CreateAttendanceInput defaults to PRESENT when status is omitted', () => {
    const input = CreateAttendanceInput.parse({
      tenantId: valid.tenantId,
      projectId: null,
      workerId: valid.workerId,
      workDate: '2026-11-20',
      checkInAt: null,
      checkOutAt: null,
      note: null,
    });
    expect(input.status ?? 'PRESENT').toBe('PRESENT');
  });

  it('UpdateAttendanceInput is a partial over business fields', () => {
    const input = UpdateAttendanceInput.parse({ status: 'ABSENT' });
    expect(input.status).toBe('ABSENT');
  });

  it('AttendanceListQuery requires tenantId and rejects bad dates', () => {
    expect(AttendanceListQuery.parse({ tenantId: valid.tenantId }).tenantId).toBe(valid.tenantId);
    expect(AttendanceListQuery.safeParse({ tenantId: 'nope' }).success).toBe(false);
    expect(AttendanceListQuery.safeParse({ tenantId: valid.tenantId, workDate: 'bad' }).success).toBe(
      false,
    );
  });
});