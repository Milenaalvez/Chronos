export type RoleType = "COLLABORATOR" | "MANAGER" | "RH" | "ADMIN" | "DEVELOPER"

export interface DashboardCardDef {
  id: string
  label: string
  roles: RoleType[]
  description: string
}

export const DASHBOARD_CARDS: DashboardCardDef[] = [
  { id: "bancoHoras", label: "Banco de Horas", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Saldo acumulado de horas" },
  { id: "horasHoje", label: "Horas Trabalhadas Hoje", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Horas trabalhadas no dia atual" },
  { id: "horasMes", label: "Horas no Mês", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Total de horas no mês" },
  { id: "horasExtras", label: "Horas Extras", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Horas extras acumuladas" },
  { id: "saldoAtual", label: "Saldo Atual", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Saldo de horas atual" },
  { id: "ultimosRegistros", label: "Últimos Registros", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Registros recentes de ponto" },
  { id: "calendarioResumido", label: "Evolução do Banco", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Gráfico de evolução semanal" },
  { id: "pendencias", label: "Pendências", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Registros em aberto" },
  { id: "justificativas", label: "Justificativas", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Justificativas registradas" },
  { id: "diasTrabalhados", label: "Dias Trabalhados", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Total de dias no mês" },
]

export interface DashboardTemplate {
  id: string
  label: string
  roles: RoleType[]
  slots: [string, string, string, string]
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  { id: "jornada", label: "Jornada", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], slots: ["bancoHoras", "horasHoje", "horasMes", "ultimosRegistros"] },
  { id: "produtividade", label: "Produtividade", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], slots: ["horasMes", "horasExtras", "saldoAtual", "calendarioResumido"] },
  { id: "banco", label: "Banco de Horas", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], slots: ["bancoHoras", "horasExtras", "saldoAtual", "horasHoje"] },
  { id: "visao-geral", label: "Visão Geral", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], slots: ["horasMes", "pendencias", "justificativas", "diasTrabalhados"] },
]

export const DEFAULT_SLOTS: [string, string, string, string] = [
  "bancoHoras", "horasMes", "horasExtras", "ultimosRegistros",
]

export interface DashboardConfig {
  slots: [string, string, string, string]
  templateId?: string
}

export function getCardsForRole(_role: string): DashboardCardDef[] {
  return DASHBOARD_CARDS
}

export function getTemplatesForRole(_role: string): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES
}

const STORAGE_KEY = "chronos-dashboard-config"

export function loadConfig(userId?: string): DashboardConfig {
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { slots: [...DEFAULT_SLOTS] }
}

export function saveConfig(config: DashboardConfig, userId?: string): void {
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY
    localStorage.setItem(key, JSON.stringify(config))
  } catch { /* ignore */ }
}

export function findBestTemplateForSlots(slots: [string, string, string, string], _role: string): string | undefined {
  for (const t of DASHBOARD_TEMPLATES) {
    if (t.slots[0] === slots[0] && t.slots[1] === slots[1] && t.slots[2] === slots[2] && t.slots[3] === slots[3]) {
      return t.id
    }
  }
  return undefined
}
