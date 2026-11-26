export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'ON_LEAVE', 'HALF_DAY'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];