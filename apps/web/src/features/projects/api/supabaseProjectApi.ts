import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from '../../../shared/supabase/client';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type ParticipationType = 'MAIN_CONTRACTOR' | 'SUBCONTRACTOR' | 'OTHER';
export type ProjectCompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';

export interface Project {
  id: string;
  tenantId: string;
  siteName: string;
  address: string;
  status: ProjectStatus;
}

export interface ProjectCompany {
  id: string;
  projectId: string;
  tenantId: string;
  participationType: ParticipationType;
  status: ProjectCompanyStatus;
}

export interface ProjectApi {
  listProjects(): Promise<Project[]>;
  createProject(input: CreateProjectInput): Promise<string>;
  inviteProjectMember(input: InviteProjectMemberInput): Promise<InviteProjectMemberResult>;
  listProjectCompanies(projectId: string): Promise<ProjectCompany[]>;
  addProjectCompany(input: AddProjectCompanyInput): Promise<string>;
  updateProjectCompany(input: UpdateProjectCompanyInput): Promise<void>;
  listProjectMembers(projectId: string): Promise<ProjectMember[]>;
  addProjectMember(input: AddProjectMemberInput): Promise<string>;
  updateProjectMemberRole(input: UpdateProjectMemberRoleInput): Promise<void>;
  removeProjectMember(membershipId: string): Promise<void>;
}

export interface CreateProjectInput {
  siteName: string;
  address?: string;
}

export interface InviteProjectMemberInput {
  projectId: string;
  projectCompanyId: string;
  email: string;
  role: ManageableProjectRole;
}

export interface InviteProjectMemberResult {
  membershipId: string;
  userId: string;
  invited: boolean;
}

/** Roles a PROJECT_MANAGER may grant. The database enforces the same limit (assert_can_touch_role). */
export type ManageableProjectRole = 'WORKER' | 'PROJECT_VIEWER';

export interface ProjectMember {
  id: string;
  projectId: string;
  tenantId: string;
  userId: string;
  role: string;
}

export interface AddProjectMemberInput {
  projectId: string;
  projectCompanyId: string;
  userId: string;
  role: ManageableProjectRole;
}

export interface UpdateProjectMemberRoleInput {
  membershipId: string;
  role: ManageableProjectRole;
}

export interface AddProjectCompanyInput {
  projectId: string;
  tenantId: string;
  participationType: 'SUBCONTRACTOR' | 'OTHER';
}

export interface UpdateProjectCompanyInput {
  projectCompanyId: string;
  participationType?: 'SUBCONTRACTOR' | 'OTHER';
  status?: ProjectCompanyStatus;
}

type Row = Record<string, unknown>;

/** Edge Function failures carry the JSON body of the HTTP response in `context`. */
async function readFunctionError(error: { message: string; context?: unknown }): Promise<string> {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      // fall through to the generic message
    }
  }
  return error.message;
}

export function toProject(row: Row): Project {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    siteName: String(row.site_name),
    address: String(row.address ?? ''),
    status: String(row.status) as ProjectStatus,
  };
}

export function toProjectMember(row: Row): ProjectMember {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    tenantId: String(row.tenant_id),
    userId: String(row.user_id),
    role: String(row.role),
  };
}

export function toProjectCompany(row: Row): ProjectCompany {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    tenantId: String(row.tenant_id),
    participationType: String(row.participation_type) as ParticipationType,
    status: String(row.status) as ProjectCompanyStatus,
  };
}

/**
 * Read-only adapter. Visibility is enforced by RLS in the database
 * (tenant scope and deleted_at is null). The filters here are an extra guard,
 * not the source of authorization.
 */
export function createSupabaseProjectApi(
  client: SupabaseClient = supabaseClient(),
): ProjectApi {
  return {
    /**
     * Returns projects owned by the tenant and projects it participates in.
     * RLS (migration 021) decides visibility; the client does not filter by tenant.
     */
    async listProjects() {
      const { data, error } = await client
        .from('projects')
        .select('id, tenant_id, site_name, address, status, deleted_at')
        .is('deleted_at', null)
        .order('site_name');
      if (error) {
        throw new Error(`Failed to list projects: ${error.message}`);
      }
      const rows = (data ?? []) as unknown as Row[];
      return rows.map(toProject);
    },

    async createProject(input) {
      const { data, error } = await client.rpc('create_project', {
        p_site_name: input.siteName,
        p_address: input.address ?? '',
        p_organization_id: null,
      });
      if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }
      return String(data);
    },

    async inviteProjectMember(input) {
      const { data, error } = await client.functions.invoke('invite-member', {
        body: {
          projectId: input.projectId,
          projectCompanyId: input.projectCompanyId,
          email: input.email,
          role: input.role,
        },
      });
      if (error) {
        throw new Error(`Failed to invite member: ${await readFunctionError(error)}`);
      }
      const result = data as { membershipId: string; userId: string; invited: boolean };
      return { membershipId: result.membershipId, userId: result.userId, invited: result.invited };
    },

    async listProjectCompanies(projectId) {
      const { data, error } = await client
        .from('project_companies')
        .select('id, project_id, tenant_id, participation_type, status')
        .eq('project_id', projectId)
        .order('participation_type');
      if (error) {
        throw new Error(`Failed to list project companies: ${error.message}`);
      }
      const rows = (data ?? []) as unknown as Row[];
      return rows.map(toProjectCompany);
    },

    /**
     * Writes go through RPCs. The database (assert_project_manager, tenant and
     * participation rules) is the authorization boundary; the UI only hides actions.
     */
    async addProjectCompany(input) {
      const { data, error } = await client.rpc('add_project_company', {
        p_project_id: input.projectId,
        p_tenant_id: input.tenantId,
        p_participation_type: input.participationType,
      });
      if (error) {
        throw new Error(`Failed to add project company: ${error.message}`);
      }
      return String(data);
    },

    async updateProjectCompany(input) {
      const { error } = await client.rpc('update_project_company', {
        p_project_company_id: input.projectCompanyId,
        p_participation_type: input.participationType ?? null,
        p_status: input.status ?? null,
      });
      if (error) {
        throw new Error(`Failed to update project company: ${error.message}`);
      }
    },

    async listProjectMembers(projectId) {
      const { data, error } = await client
        .from('project_memberships')
        .select('id, project_id, tenant_id, user_id, role')
        .eq('project_id', projectId)
        .order('role');
      if (error) {
        throw new Error(`Failed to list project members: ${error.message}`);
      }
      const rows = (data ?? []) as unknown as Row[];
      return rows.map(toProjectMember);
    },

    async addProjectMember(input) {
      const { data, error } = await client.rpc('add_project_member', {
        p_project_id: input.projectId,
        p_project_company_id: input.projectCompanyId,
        p_user_id: input.userId,
        p_role: input.role,
      });
      if (error) {
        throw new Error(`Failed to add project member: ${error.message}`);
      }
      return String(data);
    },

    async updateProjectMemberRole(input) {
      const { error } = await client.rpc('update_project_member_role', {
        p_project_membership_id: input.membershipId,
        p_role: input.role,
      });
      if (error) {
        throw new Error(`Failed to update project member: ${error.message}`);
      }
    },

    async removeProjectMember(membershipId) {
      const { error } = await client.rpc('remove_project_member', {
        p_project_membership_id: membershipId,
      });
      if (error) {
        throw new Error(`Failed to remove project member: ${error.message}`);
      }
    },
  };
}
