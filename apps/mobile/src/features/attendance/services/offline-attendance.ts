import { CreateAttendanceInput, type Attendance } from '@partner-os/contracts';
import type { AttendanceRepository } from '@partner-os/database';
import { validateAttendanceRecord } from '@partner-os/domain';
import { createUuid } from '@partner-os/shared-utils';

/**
 * Offline create use-case: validate at the boundary, ensure core business
 * rules hold, then persist locally and queue the sync.
 */
export async function createAttendanceOffline(
  repo: AttendanceRepository,
  input: CreateAttendanceInput,
): Promise<Attendance> {
  const parsed = CreateAttendanceInput.parse(input);
  const status = parsed.status ?? 'PRESENT';
  const body = {
    tenantId: parsed.tenantId,
    projectId: parsed.projectId ?? null,
    workerId: parsed.workerId,
    workDate: parsed.workDate,
    status,
    checkInAt: parsed.checkInAt ?? null,
    checkOutAt: parsed.checkOutAt ?? null,
    note: parsed.note ?? null,
  };
  validateAttendanceRecord({ id: createUuid(), ...body });
  return repo.create(body);
}