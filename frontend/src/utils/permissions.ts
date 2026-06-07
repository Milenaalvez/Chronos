export type Role = "SUPER_ADMIN" | "DEVELOPER" | "ADMIN" | "RH" | "EMPLOYEE"

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 5,
  DEVELOPER: 4,
  ADMIN: 3,
  RH: 2,
  EMPLOYEE: 1,
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrador",
  DEVELOPER: "Super Administrador",
  ADMIN: "Administrador",
  RH: "RH",
  EMPLOYEE: "Colaborador",
}

export const ROLE_SHORT_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Master",
  DEVELOPER: "Super Admin",
  ADMIN: "Admin",
  RH: "RH",
  EMPLOYEE: "Colaborador",
}

const PAGE_ACCESS: Record<string, Role[]> = {
  dashboard: ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  "ponto-registrar": ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  "registrar-ponto": ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  "ponto-meus-registros": ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  banco: ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  calendario: ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  notificacoes: ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  configuracoes: ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],

  equipe: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  relatorios: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],

  colaboradores: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  ferias: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  afastamentos: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  documentos: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  aprovacoes: ["RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],

  usuarios: ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  cargos: ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  departamentos: ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  permissoes: ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  auditoria: ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],

  admin: ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  "admin-empresa": ["ADMIN", "DEVELOPER", "SUPER_ADMIN"],
  "super-admin": ["SUPER_ADMIN"],

  logs: ["DEVELOPER"],
  monitoramento: ["DEVELOPER"],
  integracoes: ["DEVELOPER"],
  "api": ["DEVELOPER"],
  sistema: ["DEVELOPER"],
  debug: ["DEVELOPER"],
  "feature-flags": ["DEVELOPER"],
  solicitacoes: ["EMPLOYEE", "RH", "ADMIN", "DEVELOPER", "SUPER_ADMIN"],
}

export interface MenuItemDef {
  label: string
  page: string
  icon: string
}

export interface MenuGroupDef {
  label?: string
  items: MenuItemDef[]
}

export function canAccessPage(role: string | undefined | null, page: string): boolean {
  if (!role) return false
  const allowed = PAGE_ACCESS[page]
  if (!allowed) return false
  const userLevel = ROLE_HIERARCHY[role as Role] ?? 0
  return allowed.some(r => ROLE_HIERARCHY[r] <= userLevel)
}

export function getEffectiveRole(userRole: string | undefined | null, impersonatingRole: string | null): string {
  if (impersonatingRole) return impersonatingRole
  return userRole ?? "EMPLOYEE"
}

export function filterMenuGroups(
  groups: { label?: string; items: { label: string; icon: any; page: string; badge?: number }[] }[],
  effectiveRole: string,
): { label?: string; items: { label: string; icon: any; page: string; badge?: number }[] }[] {
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => canAccessPage(effectiveRole, item.page)),
    }))
    .filter(group => group.items.length > 0)
}

// ─── Legacy compatibility exports ───
export const ALL_PERMISSIONS = [
  { key: "access_team", label: "Acessar equipe", group: "Equipe" },
  { key: "manage_members", label: "Gerenciar membros", group: "Equipe" },
  { key: "approve_justifications", label: "Aprovar justificativas", group: "Justificativas" },
  { key: "edit_time_records", label: "Editar horas", group: "Registros" },
  { key: "approve_time_records", label: "Aprovar jornadas", group: "Registros" },
  { key: "reset_passwords", label: "Redefinir senhas", group: "Administração" },
  { key: "view_logs", label: "Visualizar logs", group: "Administração" },
  { key: "export_reports", label: "Exportar relatórios", group: "Relatórios" },
  { key: "access_profiles", label: "Acessar perfis", group: "Perfis" },
  { key: "switch_accounts", label: "Trocar entre contas", group: "Perfis" },
  { key: "edit_registries", label: "Editar registros", group: "Registros" },
  { key: "manage_permissions", label: "Gerenciar permissões", group: "Administração" },
  { key: "manage_company", label: "Gerenciar empresa", group: "Administração" },
  { key: "manage_tickets", label: "Gerenciar solicitações", group: "Administração" },
] as const

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map((p) => p.key),
  ADMIN: ALL_PERMISSIONS.map((p) => p.key),
  RH: [
    "access_team", "manage_members", "approve_justifications",
    "edit_time_records", "approve_time_records", "reset_passwords",
    "view_logs", "export_reports", "access_profiles", "manage_tickets",
  ],
  DEVELOPER: ALL_PERMISSIONS.map((p) => p.key),
  EMPLOYEE: ["access_team", "access_profiles"],
}

const TI_DEPARTMENTS = ["ti", "tecnologia", "technology", "t.i.", "t.i", "desenvolvimento", "engineering"]

export function canAccess(user: any, permission: string): boolean {
  if (!user) return false
  const deptLower = (user.department || "").toLowerCase().trim()
  const isTI = TI_DEPARTMENTS.some((d) => deptLower === d || deptLower.includes(d))
  if (isTI) return true

  const defaults = ROLE_PERMISSIONS[user.role] || []
  const extra = Array.isArray(user.permissions) ? user.permissions : []
  const grants = extra.filter((p: string) => !p.startsWith("!"))
  const denies = extra.filter((p: string) => p.startsWith("!")).map((p: string) => p.slice(1))
  if (denies.includes(permission)) return false
  if (defaults.includes(permission) || grants.includes(permission)) return true

  return false
}

export function getAllowedPages(role: string | undefined | null): string[] {
  if (!role) return []
  const userLevel = ROLE_HIERARCHY[role as Role] ?? 0
  return Object.entries(PAGE_ACCESS)
    .filter(([, roles]) => roles.some(r => ROLE_HIERARCHY[r] <= userLevel))
    .map(([page]) => page)
}
