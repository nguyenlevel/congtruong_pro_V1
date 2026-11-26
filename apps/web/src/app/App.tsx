import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AuthenticatedMember } from '@partner-os/auth';
import { canCreateProject, canWriteRoster } from '@partner-os/auth';
import { readWebEnv } from '../shared/config/env';
import { loadAuthenticatedMember, selectActiveTenant } from '../features/auth/membership';
import { WorkersListPage } from '../features/workers/pages/WorkersListPage';
import { AttendancePage } from '../features/attendance/pages/AttendancePage';
import { ProjectsPage } from '../features/projects/pages/ProjectsPage';
import { supabaseClient } from '../shared/supabase/client';

const webEnv = readWebEnv(import.meta.env);

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error: string | null }
  | { status: 'signed-in'; member: AuthenticatedMember };

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể xác thực. Vui lòng thử lại.';
}

export default function App(): React.JSX.Element {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    const request = ++sequence.current;
    try {
      const client = supabaseClient();
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && active) {
          sequence.current++;
          setState({ status: 'signed-out', error: null });
        }
      });
      void loadAuthenticatedMember(client).then(
        (member) => {
          if (active && request === sequence.current) {
            setState(member ? { status: 'signed-in', member } : { status: 'signed-out', error: null });
          }
        },
        (error: unknown) => {
          if (active && request === sequence.current) {
            setState({ status: 'signed-out', error: message(error) });
          }
        },
      );
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch (error) {
      setState({ status: 'signed-out', error: message(error) });
      return () => { active = false; };
    }
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const request = ++sequence.current;
    setState({ status: 'loading' });
    try {
      const client = supabaseClient();
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const member = await loadAuthenticatedMember(client);
      if (!member) throw new Error('Không thể khôi phục phiên đăng nhập.');
      if (request === sequence.current) {
        setPassword('');
        setState({ status: 'signed-in', member });
      }
    } catch (error) {
      if (request === sequence.current) setState({ status: 'signed-out', error: message(error) });
    }
  }

  async function switchTenant(tenantId: string): Promise<void> {
    const request = ++sequence.current;
    setState({ status: 'loading' });
    try {
      const client = supabaseClient();
      await selectActiveTenant(client, tenantId);
      const member = await loadAuthenticatedMember(client);
      if (!member) throw new Error('Không thể khôi phục phiên đăng nhập.');
      if (request === sequence.current) setState({ status: 'signed-in', member });
    } catch (error) {
      if (request === sequence.current) setState({ status: 'signed-out', error: message(error) });
    }
  }

  async function signOut(): Promise<void> {
    ++sequence.current;
    setState({ status: 'loading' });
    try {
      const { error } = await supabaseClient().auth.signOut();
      if (error) throw error;
      setState({ status: 'signed-out', error: null });
    } catch (error) {
      setState({ status: 'signed-out', error: message(error) });
    }
  }

  if (state.status === 'loading') return <main className="p-8">Đang xác thực...</main>;
  if (state.status === 'signed-out') {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-xl font-bold">Đăng nhập</h1>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(event) => void signIn(event)}>
          <label>Email <input className="w-full border p-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Mật khẩu <input className="w-full border p-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="border p-2" type="submit">Đăng nhập</button>
        </form>
        {state.error && <p className="mt-4 text-red-700" role="alert">{state.error}</p>}
      </main>
    );
  }
  return (
    <>
      <header className="flex items-center justify-between p-4">
        <span>Vai trò: {state.member.role}</span>
        {state.member.tenants.length > 1 && (
          <label>
            Đơn vị{' '}
            <select
              className="border p-2"
              value={state.member.tenantId}
              onChange={(event) => void switchTenant(event.target.value)}
            >
              {state.member.tenants.map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>{tenant.tenantId}</option>
              ))}
            </select>
          </label>
        )}
        <button className="border p-2" onClick={() => void signOut()}>Đăng xuất</button>
      </header>
      {state.member.role === 'WORKER' ? (
        <main className="p-8">Tài khoản này không có quyền xem danh sách nhân viên.</main>
      ) : (
        <>
          <WorkersListPage
            key={`workers-${state.member.tenantId}`}
            tenantId={state.member.tenantId}
            canCreate={canWriteRoster(state.member.role)}
          />
          <ProjectsPage
            key={`projects-${state.member.tenantId}`}
            tenantId={state.member.tenantId}
            canCreate={canCreateProject(state.member.role)}
          />
          {webEnv.features.attendance && (
            <AttendancePage key={`attendance-${state.member.tenantId}`} tenantId={state.member.tenantId} />
          )}
        </>
      )}
    </>
  );
}
