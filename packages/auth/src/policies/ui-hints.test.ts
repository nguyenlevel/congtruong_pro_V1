import { describe, expect, it } from 'vitest';
import { canCreateProject, canWriteRoster } from './ui-hints';

describe('UI role hints', () => {
  it('lets only the roles the database allows write the roster', () => {
    expect(canWriteRoster('SITE_MANAGER')).toBe(true);
    expect(canWriteRoster('SUB_CONTRACTOR')).toBe(true);
    expect(canWriteRoster('SYS_ADMIN')).toBe(true);
    expect(canWriteRoster('PROJECT_MANAGER')).toBe(false);
    expect(canWriteRoster('WORKER')).toBe(false);
    expect(canWriteRoster(undefined)).toBe(false);
  });

  it('lets managers and administrators create projects', () => {
    expect(canCreateProject('PROJECT_MANAGER')).toBe(true);
    expect(canCreateProject('SYS_ADMIN')).toBe(true);
    expect(canCreateProject('WORKER')).toBe(false);
    expect(canCreateProject(null)).toBe(false);
  });
});
