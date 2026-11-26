import { z } from 'zod';
import { EntityIdSchema, NullableProjectIdSchema, TenantIdSchema } from './common.schema';

export const AttendanceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'ON_LEAVE', 'HALF_DAY']);

/** ISO calendar date (YYYY-MM-DD) representing the work day. */
export const WorkDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'work date must be YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day || month < 1 || month > 12) return false;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day >= 1 && day <= daysInMonth;
  }, 'work date must be a real calendar date');

export const AttendanceSchema = z
  .object({
    id: EntityIdSchema,
    tenantId: TenantIdSchema,
    projectId: NullableProjectIdSchema,
    workerId: EntityIdSchema,
    workDate: WorkDateSchema,
    status: AttendanceStatusSchema,
    checkInAt: z.iso.datetime({ offset: true }).nullable(),
    checkOutAt: z.iso.datetime({ offset: true }).nullable(),
    note: z.string().max(500, 'note must be at most 500 characters').nullable(),
  })
  .strict();

export type Attendance = z.infer<typeof AttendanceSchema>;
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export function parseAttendance(input: unknown): Attendance {
  return AttendanceSchema.parse(input);
}

export type ParseAttendanceResult = ReturnType<typeof AttendanceSchema.safeParse>;

export function safeParseAttendance(input: unknown): ParseAttendanceResult {
  return AttendanceSchema.safeParse(input);
}