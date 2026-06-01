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
] as const

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ALL_PERMISSIONS.map((p) => p.key),
  RH: [
    "access_team", "manage_members", "approve_justifications",
    "edit_time_records", "approve_time_records", "reset_passwords",
    "view_logs", "export_reports", "access_profiles",
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
