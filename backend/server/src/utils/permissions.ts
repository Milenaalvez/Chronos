export type Permission =
  | 'access_team'
  | 'manage_members'
  | 'approve_justifications'
  | 'edit_time_records'
  | 'approve_time_records'
  | 'reset_passwords'
  | 'view_logs'
  | 'export_reports'
  | 'access_profiles'
  | 'switch_accounts'
  | 'edit_registries'
  | 'manage_permissions'
  | 'manage_company'

const ALL_PERMISSIONS: Permission[] = [
  'access_team', 'manage_members', 'approve_justifications',
  'edit_time_records', 'approve_time_records', 'reset_passwords',
  'view_logs', 'export_reports', 'access_profiles',
  'switch_accounts', 'edit_registries', 'manage_permissions', 'manage_company',
]

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  RH: [
    'access_team',
    'manage_members',
    'approve_justifications',
    'edit_time_records',
    'approve_time_records',
    'reset_passwords',
    'view_logs',
    'export_reports',
    'access_profiles',
  ],
  DEVELOPER: [...ALL_PERMISSIONS],
  EMPLOYEE: ['access_team', 'access_profiles'],
}

export function getEffectivePermissions(role: string, extraPermissions?: string[] | null, department?: string | null): Permission[] {
  const TI_DEPARTMENTS = ['ti', 'tecnologia', 'technology', 't.i.', 't.i', 'desenvolvimento', 'engineering']
  const deptLower = department?.toLowerCase().trim() || ''
  const isTI = TI_DEPARTMENTS.some((d) => deptLower === d || deptLower.includes(d))
  if (isTI) return ALL_PERMISSIONS

  const defaults = ROLE_PERMISSIONS[role] || []
  if (!extraPermissions || !Array.isArray(extraPermissions)) return defaults
  const grants = extraPermissions.filter((p) => !p.startsWith('!'))
  const denies = extraPermissions.filter((p) => p.startsWith('!')).map((p) => p.slice(1))
  const merged = new Set([...defaults, ...grants])
  for (const d of denies) merged.delete(d as Permission)
  return [...merged] as Permission[]
}
