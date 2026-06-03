export type RoleType = "COLLABORATOR" | "MANAGER" | "RH" | "ADMIN" | "DEVELOPER"

export const ROLES = ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"] as const

export interface DashboardCardDef {
  id: string
  label: string
  roles: RoleType[]
  description: string
}

export const DASHBOARD_CARDS: DashboardCardDef[] = [
  // ── Colaborador ──────────────────────────────────────
  { id: "bancoHoras", label: "Banco de Horas", roles: ["COLLABORATOR"], description: "Saldo acumulado de horas" },
  { id: "horasHoje", label: "Horas Trabalhadas Hoje", roles: ["COLLABORATOR"], description: "Horas trabalhadas no dia atual" },
  { id: "horasMes", label: "Horas Trabalhadas no Mês", roles: ["COLLABORATOR"], description: "Total de horas no mês" },
  { id: "horasExtras", label: "Horas Extras", roles: ["COLLABORATOR"], description: "Horas extras acumuladas" },
  { id: "saldoAtual", label: "Saldo Atual", roles: ["COLLABORATOR"], description: "Saldo de horas atual" },
  { id: "proximasFerias", label: "Próximas Férias", roles: ["COLLABORATOR"], description: "Próximo período de férias" },
  { id: "ultimosRegistros", label: "Últimos Registros", roles: ["COLLABORATOR"], description: "Registros recentes de ponto" },
  { id: "calendarioResumido", label: "Calendário Resumido", roles: ["COLLABORATOR"], description: "Visão rápida do calendário" },
  { id: "justificativas", label: "Justificativas", roles: ["COLLABORATOR"], description: "Justificativas pendentes e aprovadas" },
  { id: "notificacoes", label: "Notificações", roles: ["COLLABORATOR"], description: "Notificações recentes" },
  { id: "pendencias", label: "Pendências", roles: ["COLLABORATOR"], description: "Pendências em aberto" },
  { id: "historicoAtividades", label: "Histórico de Atividades", roles: ["COLLABORATOR"], description: "Atividades recentes" },

  // ── Gestor ───────────────────────────────────────────
  { id: "colaboradoresPresentes", label: "Colaboradores Presentes", roles: ["MANAGER"], description: "Equipe presente hoje" },
  { id: "colaboradoresAusentes", label: "Colaboradores Ausentes", roles: ["MANAGER"], description: "Equipe ausente hoje" },
  { id: "colaboradoresAtrasados", label: "Colaboradores Atrasados", roles: ["MANAGER"], description: "Equipe atrasada hoje" },
  { id: "bancoHorasEquipe", label: "Banco de Horas da Equipe", roles: ["MANAGER"], description: "Saldo da equipe" },
  { id: "horasExtrasEquipe", label: "Horas Extras da Equipe", roles: ["MANAGER"], description: "Extras acumuladas pela equipe" },
  { id: "aprovacoesPendentes", label: "Aprovações Pendentes", roles: ["MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Registros aguardando aprovação" },
  { id: "justificativasPendentes", label: "Justificativas Pendentes", roles: ["MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Justificativas em análise" },
  { id: "solicitacoesPendentes", label: "Solicitações Pendentes", roles: ["MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Solicitações em aberto" },
  { id: "equipeFerias", label: "Equipe em Férias", roles: ["MANAGER"], description: "Membros em férias" },
  { id: "produtividadeEquipe", label: "Produtividade da Equipe", roles: ["MANAGER"], description: "Indicadores de produtividade" },
  { id: "ultimosRegistrosEquipe", label: "Últimos Registros da Equipe", roles: ["MANAGER"], description: "Registros recentes da equipe" },
  { id: "alertasEquipe", label: "Alertas da Equipe", roles: ["MANAGER"], description: "Alertas sobre a equipe" },

  // ── RH ───────────────────────────────────────────────
  { id: "totalColaboradores", label: "Total de Colaboradores", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Quantidade total" },
  { id: "colaboradoresAtivos", label: "Colaboradores Ativos", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Colaboradores ativos" },
  { id: "presentesHoje", label: "Presentes Hoje", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Colaboradores presentes" },
  { id: "ausentesHoje", label: "Ausentes Hoje", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Colaboradores ausentes" },
  { id: "atrasadosHoje", label: "Atrasados Hoje", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Colaboradores atrasados" },
  { id: "emFerias", label: "Em Férias", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Colaboradores em férias" },
  { id: "bancoNegativo", label: "Banco de Horas Negativo", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Colaboradores com saldo negativo" },
  { id: "horasExtrasEmpresa", label: "Horas Extras da Empresa", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Total de horas extras" },
  { id: "fechamentosPendentes", label: "Fechamentos Pendentes", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Fechamentos em aberto" },
  { id: "documentacoesPendentes", label: "Documentações Pendentes", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Documentos pendentes" },
  { id: "solicitacoesFerias", label: "Solicitações de Férias", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Pedidos de férias" },
  { id: "auditoriasRecentes", label: "Auditorias Recentes", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Auditorias realizadas" },
  { id: "indicadoresPresenca", label: "Indicadores de Presença", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Taxa de presença" },
  { id: "indicadoresMensais", label: "Indicadores Mensais", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Métricas do mês" },

  // ── Developer ─────────────────────────────────────────
  { id: "usuariosOnline", label: "Usuários Online", roles: ["DEVELOPER"], description: "Usuários ativos agora" },
  { id: "sessoesAtivas", label: "Sessões Ativas", roles: ["DEVELOPER"], description: "Sessões em andamento" },
  { id: "logsRecentes", label: "Logs Recentes", roles: ["DEVELOPER"], description: "Logs do sistema" },
  { id: "errosSistema", label: "Erros do Sistema", roles: ["DEVELOPER"], description: "Erros registrados" },
  { id: "usoBancoDados", label: "Uso de Banco de Dados", roles: ["DEVELOPER"], description: "Métricas do banco" },
  { id: "usoApi", label: "Uso da API", roles: ["DEVELOPER"], description: "Requisições à API" },
  { id: "performance", label: "Performance", roles: ["DEVELOPER"], description: "Métricas de performance" },
  { id: "jobsExecutados", label: "Jobs Executados", roles: ["DEVELOPER"], description: "Jobs agendados" },
  { id: "integracoes", label: "Integrações", roles: ["DEVELOPER"], description: "Status das integrações" },
  { id: "alertasTecnicos", label: "Alertas Técnicos", roles: ["DEVELOPER"], description: "Alertas do sistema" },
  { id: "monitoramento", label: "Monitoramento do Sistema", roles: ["DEVELOPER"], description: "Monitoramento geral" },
]

export interface DashboardTemplate {
  id: string
  label: string
  roles: RoleType[]
  slots: [string, string, string, string]
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  // Colaborador
  { id: "colab-jornada", label: "Jornada", roles: ["COLLABORATOR"], slots: ["bancoHoras", "horasHoje", "horasMes", "ultimosRegistros"] },
  { id: "colab-produtividade", label: "Produtividade", roles: ["COLLABORATOR"], slots: ["horasMes", "horasExtras", "saldoAtual", "calendarioResumido"] },
  { id: "colab-banco", label: "Banco de Horas", roles: ["COLLABORATOR"], slots: ["bancoHoras", "horasExtras", "saldoAtual", "horasHoje"] },

  // Gestor
  { id: "gestor-equipe", label: "Gestão de Equipe", roles: ["MANAGER"], slots: ["colaboradoresPresentes", "colaboradoresAusentes", "colaboradoresAtrasados", "equipeFerias"] },
  { id: "gestor-produtividade", label: "Produtividade", roles: ["MANAGER"], slots: ["bancoHorasEquipe", "horasExtrasEquipe", "produtividadeEquipe", "ultimosRegistrosEquipe"] },
  { id: "gestor-banco", label: "Banco de Horas", roles: ["MANAGER"], slots: ["bancoHorasEquipe", "horasExtrasEquipe", "aprovacoesPendentes", "justificativasPendentes"] },

  // RH
  { id: "rh-operacional", label: "RH Operacional", roles: ["RH", "ADMIN"], slots: ["presentesHoje", "ausentesHoje", "emFerias", "justificativasPendentes"] },
  { id: "rh-estrategico", label: "RH Estratégico", roles: ["RH", "ADMIN"], slots: ["totalColaboradores", "colaboradoresAtivos", "indicadoresPresenca", "indicadoresMensais"] },
  { id: "rh-auditoria", label: "RH Auditoria", roles: ["RH", "ADMIN"], slots: ["auditoriasRecentes", "fechamentosPendentes", "documentacoesPendentes", "solicitacoesFerias"] },

  // Developer
  { id: "dev-monitoramento", label: "Monitoramento", roles: ["DEVELOPER"], slots: ["usuariosOnline", "sessoesAtivas", "performance", "alertasTecnicos"] },
  { id: "dev-logs", label: "Logs", roles: ["DEVELOPER"], slots: ["logsRecentes", "errosSistema", "usoApi", "usoBancoDados"] },
  { id: "dev-performance", label: "Performance", roles: ["DEVELOPER"], slots: ["performance", "jobsExecutados", "integracoes", "monitoramento"] },
]

export const DEFAULT_SLOTS: [string, string, string, string] = [
  "bancoHoras", "horasMes", "horasExtras", "ultimosRegistros",
]

export interface DashboardConfig {
  slots: [string, string, string, string]
  templateId?: string
}

export function getCardsForRole(role: string): DashboardCardDef[] {
  return DASHBOARD_CARDS.filter(c => c.roles.includes(role as RoleType))
}

export function getTemplatesForRole(role: string): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES.filter(t => t.roles.includes(role as RoleType))
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

export function findBestTemplateForSlots(slots: [string, string, string, string], role: string): string | undefined {
  const templates = getTemplatesForRole(role)
  for (const t of templates) {
    if (t.slots[0] === slots[0] && t.slots[1] === slots[1] && t.slots[2] === slots[2] && t.slots[3] === slots[3]) {
      return t.id
    }
  }
  return undefined
}
