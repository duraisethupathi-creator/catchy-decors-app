import type { Role } from './authService';

export type Permission =
  | 'customers.manage'
  | 'measurements.manage'
  | 'quotations.manage'
  | 'work_status.manage'
  | 'payments.manage'
  | 'service_bills.manage'
  | 'expenses.view'
  | 'expenses.manage'
  | 'profit.view'
  | 'rates.manage'
  | 'settings.manage'
  | 'cloud_sync.manage'
  | 'users.manage'
  | 'critical_delete';

const STAFF: Permission[] = [
  'customers.manage',
  'measurements.manage',
  'quotations.manage',
  'work_status.manage',
  'payments.manage',
  'service_bills.manage',
];

const ADMIN: Permission[] = [
  ...STAFF,
  'expenses.view',
  'expenses.manage',
  'profit.view',
  'rates.manage',
  'settings.manage',
  'cloud_sync.manage',
  'users.manage',
  'critical_delete',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ADMIN,
  staff: STAFF,
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  const normalized = String(role ?? '').trim().toLowerCase() as Role;
  if (normalized === 'admin') return true;
  if (normalized !== 'staff') return false;
  return ROLE_PERMISSIONS.staff.includes(permission);
}

export function isAdmin(role: Role | undefined | null): boolean {
  return role === 'admin';
}
