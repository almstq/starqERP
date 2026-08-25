import { describe, it, expect } from 'vitest';
import { UserRole, AppUser, PermissionModule, PermissionAction } from '../types/erp';

describe('RBAC & Permission Gating Tests (SERP-195 / SERP-163)', () => {
  const adminRole: UserRole = {
    id: 'role-admin',
    name: 'Admin / Owner',
    description: 'Full administrative access',
    isSystemAdmin: true,
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'invoices', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'payments', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'inventory', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'purchasing', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'expenses', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'customers', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'suppliers', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'reports', actions: ['view', 'export'] },
      { module: 'settings', actions: ['view', 'edit'] },
      { module: 'users', actions: ['view', 'edit', 'authorize', 'suspend'] },
      { module: 'roles', actions: ['view', 'edit'] },
      { module: 'audit', actions: ['view'] },
    ]
  };

  const technicianRole: UserRole = {
    id: 'role-tech',
    name: 'Technician',
    description: 'Workshop floor technician',
    isSystemAdmin: false,
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'edit'] },
      { module: 'inventory', actions: ['view'] },
    ]
  };

  const activeAdmin: AppUser = {
    id: 'user-1',
    name: 'Ali Mushthaq',
    email: 'ali@starq.io',
    phone: '7774356',
    roleId: 'role-admin',
    roleName: 'Admin / Owner',
    status: 'Active',
    joinedDate: '2026-08-01',
    authorizedBy: 'Founder',
    authorizedAt: '2026-08-01 00:00',
    lastActiveAt: 'Active now'
  };

  const activeTechnician: AppUser = {
    id: 'user-2',
    name: 'Ahmed Farish',
    email: 'farish@ignition.mv',
    phone: '7771234',
    roleId: 'role-tech',
    roleName: 'Technician',
    status: 'Active',
    joinedDate: '2026-08-10',
    authorizedBy: 'Ali Mushthaq',
    authorizedAt: '2026-08-10 09:00',
    lastActiveAt: 'Active now'
  };

  const pendingUser: AppUser = {
    id: 'user-3',
    name: 'New Trainee',
    email: 'trainee@ignition.mv',
    phone: '7779999',
    roleId: 'role-tech',
    roleName: 'Technician',
    status: 'Pending Approval',
    joinedDate: '2026-08-25',
    lastActiveAt: 'Just signed in'
  };

  function evaluateUserPermission(
    user: AppUser,
    roles: UserRole[],
    module: PermissionModule,
    action: PermissionAction = 'view'
  ): boolean {
    if (user.status !== 'Active') return false;
    const role = roles.find((r) => r.id === user.roleId);
    if (!role) return false;
    if (role.isSystemAdmin) return true;

    const modulePerm = role.permissions.find((p) => p.module === module);
    if (!modulePerm) return false;
    return modulePerm.actions.includes(action);
  }

  it('allows active admin to view and edit invoices', () => {
    const canView = evaluateUserPermission(activeAdmin, [adminRole, technicianRole], 'invoices', 'view');
    const canCreate = evaluateUserPermission(activeAdmin, [adminRole, technicianRole], 'invoices', 'create');
    expect(canView).toBe(true);
    expect(canCreate).toBe(true);
  });

  it('prohibits technician from creating or deleting invoices', () => {
    const canView = evaluateUserPermission(activeTechnician, [adminRole, technicianRole], 'invoices', 'view');
    const canCreate = evaluateUserPermission(activeTechnician, [adminRole, technicianRole], 'invoices', 'create');
    const canDelete = evaluateUserPermission(activeTechnician, [adminRole, technicianRole], 'invoices', 'delete');
    expect(canView).toBe(false);
    expect(canCreate).toBe(false);
    expect(canDelete).toBe(false);
  });

  it('allows technician to view and edit jobs on the workshop floor', () => {
    const canViewJobs = evaluateUserPermission(activeTechnician, [adminRole, technicianRole], 'jobs', 'view');
    const canEditJobs = evaluateUserPermission(activeTechnician, [adminRole, technicianRole], 'jobs', 'edit');
    expect(canViewJobs).toBe(true);
    expect(canEditJobs).toBe(true);
  });

  it('strictly refuses all permissions for users in Pending Approval state', () => {
    const canViewDash = evaluateUserPermission(pendingUser, [adminRole, technicianRole], 'dashboard', 'view');
    const canViewJobs = evaluateUserPermission(pendingUser, [adminRole, technicianRole], 'jobs', 'view');
    expect(canViewDash).toBe(false);
    expect(canViewJobs).toBe(false);
  });
});
