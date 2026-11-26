import { useEffect, useMemo, useState } from 'react';
import {
  createSupabaseProjectApi,
  type ManageableProjectRole,
  type Project,
  type ProjectCompany,
  type ProjectApi,
  type ProjectMember,
} from '../api/supabaseProjectApi';

const PROJECT_STATUS_LABEL: Record<Project['status'], string> = {
  PLANNING: 'Lập kế hoạch',
  ACTIVE: 'Đang thi công',
  ON_HOLD: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
};

export function ProjectsPage({
  tenantId,
  api: injectedApi,
  canCreate = false,
}: {
  tenantId: string;
  api?: ProjectApi;
  canCreate?: boolean;
}): React.JSX.Element {
  const api = useMemo(() => injectedApi ?? createSupabaseProjectApi(), [injectedApi]);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [companies, setCompanies] = useState<ProjectCompany[]>([]);
  const [newTenantId, setNewTenantId] = useState('');
  const [newType, setNewType] = useState<'SUBCONTRACTOR' | 'OTHER'>('SUBCONTRACTOR');
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [newMemberCompanyId, setNewMemberCompanyId] = useState('');
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ManageableProjectRole>('WORKER');
  const [newSiteName, setNewSiteName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [inviteCompanyId, setInviteCompanyId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ManageableProjectRole>('WORKER');
  const [notice, setNotice] = useState<string | null>(null);
  const [projectsKey, setProjectsKey] = useState(0);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!newSiteName.trim()) return;
    setActionError(null);
    try {
      await api.createProject({ siteName: newSiteName.trim(), address: newAddress.trim() });
      setNewSiteName('');
      setNewAddress('');
      setProjectsKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không tạo được dự án.');
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !inviteCompanyId || !inviteEmail.trim()) return;
    setNotice(null);
    await runCompanyAction(async () => {
      const result = await api.inviteProjectMember({
        projectId: selected.id,
        projectCompanyId: inviteCompanyId,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setNotice(result.invited ? 'Đã gửi email mời và thêm vào dự án.' : 'Đã thêm người dùng vào dự án.');
    });
  }

  useEffect(() => {
    if (!selected || selected.tenantId !== tenantId) return;
    let active = true;
    setMembers([]);
    api.listProjectMembers(selected.id).then(
      (rows) => { if (active) setMembers(rows); },
      (err: unknown) => { if (active) setActionError(err instanceof Error ? err.message : 'Không tải được thành viên.'); },
    );
    return () => { active = false; };
  }, [api, selected, tenantId, reloadKey]);

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !newMemberCompanyId || !newMemberUserId.trim()) return;
    await runCompanyAction(async () => {
      await api.addProjectMember({
        projectId: selected.id,
        projectCompanyId: newMemberCompanyId,
        userId: newMemberUserId.trim(),
        role: newMemberRole,
      });
      setNewMemberUserId('');
    });
  }


  useEffect(() => {
    let active = true;
    setProjects(null);
    setError(null);
    setSelected(null);
    api.listProjects().then(
      (rows) => { if (active) setProjects(rows); },
      (err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Không tải được dự án.'); },
    );
    return () => { active = false; };
  }, [api, tenantId, projectsKey]);

  useEffect(() => {
    if (!selected || selected.tenantId !== tenantId) return;
    let active = true;
    setCompanies([]);
    api.listProjectCompanies(selected.id).then(
      (rows) => { if (active) setCompanies(rows); },
      (err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Không tải được công ty tham gia.'); },
    );
    return () => { active = false; };
  }, [api, selected, tenantId, reloadKey]);

  async function runCompanyAction(action: () => Promise<unknown>): Promise<void> {
    setActionError(null);
    try {
      await action();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    }
  }

  async function handleAddCompany(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !newTenantId.trim()) return;
    await runCompanyAction(async () => {
      await api.addProjectCompany({
        projectId: selected.id,
        tenantId: newTenantId.trim(),
        participationType: newType,
      });
      setNewTenantId('');
    });
  }


  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">Dự án</h1>

      {canCreate && (
        <form className="mt-4 space-y-2" onSubmit={handleCreateProject} aria-label="Tạo dự án">
          <label className="block">
            <span className="text-sm">Tên dự án</span>
            <input className="mt-1 w-full border p-1" maxLength={200} value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm">Địa chỉ</span>
            <input className="mt-1 w-full border p-1" maxLength={500} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          </label>
          <button type="submit" className="border px-3 py-1" disabled={!newSiteName.trim()}>Tạo dự án</button>
        </form>
      )}
      {!selected && actionError && <p className="mt-2 text-red-700" role="alert">{actionError}</p>}
      {error && <p className="mt-4 text-red-700" role="alert">{error}</p>}
      {!error && projects === null && <p className="mt-4">Đang tải...</p>}
      {projects !== null && projects.length === 0 && (
        <p className="mt-4 text-neutral-500">Chưa có dự án nào trong đơn vị này.</p>
      )}

      {projects !== null && projects.length > 0 && (
        <ul className="mt-4 space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <button className="w-full border p-2 text-left" onClick={() => setSelected(project)}>
                <span className="font-medium">{project.siteName}</span>
                <span className="ml-2 text-neutral-500">{PROJECT_STATUS_LABEL[project.status]}</span>
                {project.tenantId !== tenantId && <span className="ml-2 text-sm text-blue-700">Tham gia (chỉ xem)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && selected.tenantId !== tenantId && (
        <section className="mt-6 border-t pt-4" aria-label="Chi tiết dự án">
          <h2 className="font-semibold">{selected.siteName}</h2>
          <p className="text-neutral-500">{selected.address || 'Chưa có địa chỉ'}</p>
          <p className="mt-2 text-neutral-500">Dự án do đơn vị khác quản lý. Bạn chỉ có quyền xem thông tin dự án.</p>
        </section>
      )}

      {selected && selected.tenantId === tenantId && (
        <section className="mt-6 border-t pt-4" aria-label="Chi tiết dự án">
          <h2 className="font-semibold">{selected.siteName}</h2>
          <p className="text-neutral-500">{selected.address || 'Chưa có địa chỉ'}</p>
          <h3 className="mt-4 font-medium">Công ty tham gia</h3>
          {actionError && <p className="mt-2 text-red-700" role="alert">{actionError}</p>}
          {companies.length === 0 ? (
            <p className="text-neutral-500">Chưa có công ty tham gia.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {companies.map((company) => (
                <li key={company.id} className="flex items-center gap-2">
                  <span>{company.participationType}</span>
                  <span className="text-neutral-500">{company.status}</span>
                  {company.participationType !== 'MAIN_CONTRACTOR' && company.status === 'ACTIVE' && (
                    <button className="border px-2 text-sm" onClick={() => runCompanyAction(() => api.updateProjectCompany({ projectCompanyId: company.id, status: 'SUSPENDED' }))}>
                      Tạm ngưng
                    </button>
                  )}
                  {company.participationType !== 'MAIN_CONTRACTOR' && company.status !== 'ENDED' && (
                    <button className="border px-2 text-sm" onClick={() => runCompanyAction(() => api.updateProjectCompany({ projectCompanyId: company.id, status: 'ENDED' }))}>
                      Kết thúc
                    </button>
                  )}
                  {company.participationType !== 'MAIN_CONTRACTOR' && company.status === 'SUSPENDED' && (
                    <button className="border px-2 text-sm" onClick={() => runCompanyAction(() => api.updateProjectCompany({ projectCompanyId: company.id, status: 'ACTIVE' }))}>
                      Kích hoạt lại
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form className="mt-4 space-y-2" onSubmit={handleAddCompany} aria-label="Thêm công ty tham gia">
            <label className="block">
              <span className="text-sm">ID đơn vị (tenant)</span>
              <input className="mt-1 w-full border p-1" value={newTenantId} onChange={(e) => setNewTenantId(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm">Vai trò tham gia</span>
              <select className="mt-1 w-full border p-1" value={newType} onChange={(e) => setNewType(e.target.value as 'SUBCONTRACTOR' | 'OTHER')}>
                <option value="SUBCONTRACTOR">Nhà thầu phụ</option>
                <option value="OTHER">Khác</option>
              </select>
            </label>
            <button type="submit" className="border px-3 py-1">Thêm công ty</button>
          </form>

          <h3 className="mt-6 font-medium">Thành viên dự án</h3>
          {members.length === 0 ? (
            <p className="text-neutral-500">Chưa có thành viên.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {members.map((member) => {
                const manageable = member.role === 'WORKER' || member.role === 'PROJECT_VIEWER';
                return (
                  <li key={member.id} className="flex items-center gap-2">
                    <span className="font-mono text-sm">{member.userId}</span>
                    <span className="text-neutral-500">{member.role}</span>
                    {manageable && (
                      <>
                        <select
                          aria-label="Đổi vai trò thành viên"
                          className="border p-1 text-sm"
                          value={member.role}
                          onChange={(e) => runCompanyAction(() => api.updateProjectMemberRole({ membershipId: member.id, role: e.target.value as ManageableProjectRole }))}
                        >
                          <option value="WORKER">WORKER</option>
                          <option value="PROJECT_VIEWER">PROJECT_VIEWER</option>
                        </select>
                        <button className="border px-2 text-sm" onClick={() => runCompanyAction(() => api.removeProjectMember(member.id))}>
                          Thu hồi
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <form className="mt-4 space-y-2" onSubmit={handleAddMember} aria-label="Thêm thành viên dự án">
            <label className="block">
              <span className="text-sm">Công ty</span>
              <select className="mt-1 w-full border p-1" value={newMemberCompanyId} onChange={(e) => setNewMemberCompanyId(e.target.value)}>
                <option value="">-- Chọn công ty --</option>
                {companies.filter((c) => c.status === 'ACTIVE').map((c) => (
                  <option key={c.id} value={c.id}>{c.participationType} ({c.tenantId})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm">ID người dùng</span>
              <input className="mt-1 w-full border p-1" value={newMemberUserId} onChange={(e) => setNewMemberUserId(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm">Vai trò</span>
              <select className="mt-1 w-full border p-1" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value as ManageableProjectRole)}>
                <option value="WORKER">WORKER</option>
                <option value="PROJECT_VIEWER">PROJECT_VIEWER</option>
              </select>
            </label>
            <button type="submit" className="border px-3 py-1" disabled={!newMemberCompanyId}>Thêm thành viên</button>
          </form>

          <form className="mt-4 space-y-2" onSubmit={handleInvite} aria-label="Mời thành viên qua email">
            <label className="block">
              <span className="text-sm">Công ty</span>
              <select className="mt-1 w-full border p-1" value={inviteCompanyId} onChange={(e) => setInviteCompanyId(e.target.value)}>
                <option value="">-- Chọn công ty --</option>
                {companies.filter((c) => c.status === 'ACTIVE' && c.tenantId === tenantId).map((c) => (
                  <option key={c.id} value={c.id}>{c.participationType}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm">Email</span>
              <input className="mt-1 w-full border p-1" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm">Vai trò</span>
              <select className="mt-1 w-full border p-1" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ManageableProjectRole)}>
                <option value="WORKER">WORKER</option>
                <option value="PROJECT_VIEWER">PROJECT_VIEWER</option>
              </select>
            </label>
            <button type="submit" className="border px-3 py-1" disabled={!inviteCompanyId || !inviteEmail.trim()}>Mời qua email</button>
            {notice && <p className="text-green-700" role="status">{notice}</p>}
          </form>


        </section>
      )}
    </main>
  );
}
