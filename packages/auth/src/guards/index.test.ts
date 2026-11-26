import { describe, expect, it } from 'vitest';
import { AuthorizationError, assertPermission, hasPermission } from '.';
import { roleHasPermission } from '../policies';
import { isUserRole } from '../roles';

describe('guard: assertPermission', () => {
  it('allows a SITE_MANAGER to approve safety', () => {
    expect(() => assertPermission('SITE_MANAGER', 'safety.approve')).not.toThrow();
  });

  it('allows a WORKER to create an incident', () => {
    expect(() => assertPermission('WORKER', 'incident.create')).not.toThrow();
  });

  it('denies a WORKER from exporting reports', () => {
    expect(() => assertPermission('WORKER', 'report.export')).toThrow(AuthorizationError);
  });

  it('denies an anonymous (undefined) role', () => {
    expect(hasPermission(undefined, 'project.read')).toBe(false);
  });

  it('PROJECT_VIEWER is read-only on projects', () => {
    expect(roleHasPermission('PROJECT_VIEWER', 'project.read')).toBe(true);
    expect(roleHasPermission('PROJECT_VIEWER', 'project.write')).toBe(false);
    expect(roleHasPermission('PROJECT_VIEWER', 'report.export')).toBe(true);
  });
});

describe('UserRole type guards', () => {
  it('validates a role string', () => {
    expect(isUserRole('SITE_MANAGER')).toBe(true);
    expect(isUserRole('UNKNOWN_ROLE')).toBe(false);
  });
});

describe('PROJECT_MANAGER permission matrix', () => {
  it('manages project companies and contractors but not safety or incident approval', () => {
    expect(roleHasPermission('PROJECT_MANAGER', 'project.write')).toBe(true);
    expect(roleHasPermission('PROJECT_MANAGER', 'contractor.write')).toBe(true);
    expect(roleHasPermission('PROJECT_MANAGER', 'safety.approve')).toBe(false);
    expect(roleHasPermission('PROJECT_MANAGER', 'incident.approve')).toBe(false);
  });
});
