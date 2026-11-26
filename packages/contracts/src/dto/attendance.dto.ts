import { z } from 'zod';
import { AttendanceSchema, WorkDateSchema } from '../schemas/attendance.schema';
import { NullableProjectIdSchema, TenantIdSchema } from '../schemas/common.schema';

export const CreateAttendanceInput = AttendanceSchema.omit({ id: true, status: true }).extend({
  status: AttendanceSchema.shape.status.optional(),
  checkInAt: AttendanceSchema.shape.checkInAt.optional(),
  checkOutAt: AttendanceSchema.shape.checkOutAt.optional(),
  note: AttendanceSchema.shape.note.optional(),
});

export type CreateAttendanceInput = z.infer<typeof CreateAttendanceInput>;

export const UpdateAttendanceInput = AttendanceSchema.omit({ id: true, tenantId: true, workerId: true })
  .partial();

export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceInput>;

export const AttendanceListQuery = z.object({
  tenantId: TenantIdSchema,
  projectId: NullableProjectIdSchema.optional(),
  workerId: z.uuid('worker id must be a valid UUID').optional(),
  workDate: WorkDateSchema.optional(),
  status: AttendanceSchema.shape.status.optional(),
});

export type AttendanceListQuery = z.infer<typeof AttendanceListQuery>;