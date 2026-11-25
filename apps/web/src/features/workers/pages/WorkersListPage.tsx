import { useEffect, useState, useSyncExternalStore } from 'react';
import { translate } from '@partner-os/i18n';
import { createSupabaseWorkerApi } from '../api/supabaseWorkerApi';
import { createWorkersStore } from '../store/workersStore';
import { createWorker } from '../services/worker-application';

function workerRow(worker: {
  id: string;
  code: string;
  fullName: string;
  status: string;
  phoneNumber: string;
}): React.JSX.Element {
  return (
    <li key={worker.id}>
      <span className="font-medium">{worker.fullName}</span>
      <span className="ml-2 text-neutral-500">({worker.code})</span>
      <span className={`ml-2 ${worker.status === 'ACTIVE' ? 'text-success' : 'text-warning'}`}>
        {worker.status}
      </span>
      <span className="ml-2 text-neutral-400">{worker.phoneNumber}</span>
    </li>
  );
}

export function WorkersListPage({
  tenantId,
  canCreate = false,
}: {
  tenantId: string;
  /** Shows the create form. A UI hint only: the database policies decide who may write. */
  canCreate?: boolean;
}): React.JSX.Element {
  const [store] = useState(createWorkersStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ code: '', fullName: '', phoneNumber: '' });
  const [formMessage, setFormMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void store.load(createSupabaseWorkerApi(), { tenantId });
  }, [store, tenantId, reloadKey]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormMessage(null);
    try {
      await createWorker(createSupabaseWorkerApi(), {
        tenantId,
        projectId: null,
        code: form.code.trim().toUpperCase(),
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
      });
      setForm({ code: '', fullName: '', phoneNumber: '' });
      setFormMessage({ kind: 'ok', text: 'Đã thêm nhân sự.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Không thêm được nhân sự.' });
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">{translate('vi', 'nav.workers')}</h1>

      {canCreate && (
        <form className="mt-4 space-y-2" onSubmit={(event) => void handleCreate(event)} aria-label={translate('vi', 'workerForm.add')}>
          <label className="block">
            <span className="text-sm">{translate('vi', 'workerForm.code')}</span>
            <input className="mt-1 w-full border p-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm">{translate('vi', 'workerForm.fullName')}</span>
            <input className="mt-1 w-full border p-1" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm">{translate('vi', 'workerForm.phone')}</span>
            <input className="mt-1 w-full border p-1" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
          </label>
          <button type="submit" className="border px-3 py-1">{translate('vi', 'workerForm.submit')}</button>
          {formMessage && (
            <p className={formMessage.kind === 'ok' ? 'text-success' : 'text-red-700'} role={formMessage.kind === 'ok' ? 'status' : 'alert'}>
              {formMessage.text}
            </p>
          )}
        </form>
      )}

      {state.status === 'loading' && <p className="mt-4">{translate('vi', 'common.loading')}</p>}

      {state.status === 'error' && (
        <p className="mt-4 text-warning" role="alert">
          {state.error ?? translate('vi', 'common.error')}
        </p>
      )}

      {state.status === 'loaded' && state.workers.length === 0 && (
        <p className="mt-4 text-neutral-500">{translate('vi', 'common.empty')}</p>
      )}

      {state.status === 'loaded' && state.workers.length > 0 && (
        <ul className="mt-4 space-y-2">{state.workers.map(workerRow)}</ul>
      )}
    </main>
  );
}
