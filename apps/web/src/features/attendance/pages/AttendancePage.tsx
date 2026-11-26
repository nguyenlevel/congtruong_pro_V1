import { useEffect, useState, useSyncExternalStore } from 'react';
import { translate } from '@partner-os/i18n';
import { createSupabaseAttendanceApi } from '../api/supabaseAttendanceApi';
import { createAttendanceStore } from '../store/attendanceStore';

function attendanceRow(record: {
  workDate: string;
  workerId: string;
  status: string;
  note: string | null;
}): React.JSX.Element {
  const tone = record.status === 'PRESENT' ? 'text-success' : 'text-warning';
  return (
    <li key={`${record.workerId}-${record.workDate}`}>
      <span className="font-medium">{record.workDate}</span>
      <span className="ml-2 text-neutral-500">({record.workerId})</span>
      <span className={`ml-2 ${tone}`}>{record.status}</span>
      {record.note && <span className="ml-2 text-neutral-400">{record.note}</span>}
    </li>
  );
}

export function AttendancePage({ tenantId }: { tenantId: string }): React.JSX.Element {
  const [store] = useState(createAttendanceStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    void store.load(createSupabaseAttendanceApi(), { tenantId });
  }, [store, tenantId]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">{translate('vi', 'nav.attendance')}</h1>

      {state.status === 'loading' && <p className="mt-4">{translate('vi', 'common.loading')}</p>}

      {state.status === 'error' && (
        <p className="mt-4 text-warning" role="alert">
          {state.error ?? translate('vi', 'common.error')}
        </p>
      )}

      {state.status === 'loaded' && state.records.length === 0 && (
        <p className="mt-4 text-neutral-500">{translate('vi', 'common.empty')}</p>
      )}

      {state.status === 'loaded' && state.records.length > 0 && (
        <ul className="mt-4 space-y-2">{state.records.map(attendanceRow)}</ul>
      )}
    </main>
  );
}