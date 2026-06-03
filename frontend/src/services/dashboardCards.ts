export type RoleType = "COLLABORATOR" | "MANAGER" | "RH" | "ADMIN" | "DEVELOPER"
export type SlotType = "stat" | "medium" | "wide"
export type WidgetCategory = "JORNADA" | "REGISTROS" | "RH" | "EQUIPE" | "AUDITORIA" | "PRODUTIVIDADE" | "SISTEMA"

export interface SlotDef {
  id: string
  label: string
  slotType: SlotType
}

export const SLOTS: SlotDef[] = [
  { id: "slot01", label: "Posição 1", slotType: "stat" },
  { id: "slot02", label: "Posição 2", slotType: "stat" },
  { id: "slot03", label: "Posição 3", slotType: "stat" },
  { id: "slot04", label: "Posição 4", slotType: "stat" },
  { id: "slot05", label: "Posição 5", slotType: "medium" },
  { id: "slot06", label: "Posição 6", slotType: "medium" },
  { id: "slot07", label: "Posição 7", slotType: "medium" },
  { id: "slot08", label: "Posição 8", slotType: "medium" },
  { id: "slot09", label: "Posição 9", slotType: "wide" },
]

export type SlotConfig = [string, string, string, string, string, string, string, string, string]

export interface WidgetDef {
  id: string
  label: string
  category: WidgetCategory
  slotType: SlotType | SlotType[]
  roles: RoleType[]
  description: string
  hasData: boolean
}

export const WIDGETS: WidgetDef[] = [
  // ── JORNADA ──
  { id: "bancoHoras", label: "Banco de Horas", category: "JORNADA", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Saldo acumulado de horas", hasData: true },
  { id: "horasHoje", label: "Horas Trabalhadas Hoje", category: "JORNADA", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Horas trabalhadas no dia atual", hasData: true },
  { id: "horasMes", label: "Horas Trabalhadas no Mês", category: "JORNADA", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Total de horas no mês", hasData: true },
  { id: "horasExtras", label: "Horas Extras", category: "JORNADA", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Horas extras acumuladas", hasData: true },
  { id: "saldoAtual", label: "Saldo Atual", category: "JORNADA", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Saldo de horas atual", hasData: true },
  { id: "metaSemanal", label: "Meta Semanal", category: "JORNADA", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Acompanhamento de meta semanal e mensal", hasData: true },
  { id: "evolucaoBanco", label: "Evolução do Banco de Horas", category: "JORNADA", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Gráfico de evolução semanal", hasData: true },
  { id: "distribuicaoHoras", label: "Distribuição de Horas", category: "JORNADA", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Gráfico de distribuição por tipo", hasData: true },

  // ── REGISTROS ──
  { id: "ultimosRegistros", label: "Registros Recentes", category: "REGISTROS", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Últimos registros de ponto", hasData: true },
  { id: "pendencias", label: "Registros Pendentes", category: "REGISTROS", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Registros em aberto", hasData: true },
  { id: "justificativas", label: "Justificativas", category: "REGISTROS", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Justificativas registradas", hasData: true },
  { id: "diasTrabalhados", label: "Dias Trabalhados", category: "REGISTROS", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Total de dias no mês", hasData: true },
  { id: "registrosInconsistentes", label: "Registros Inconsistentes", category: "REGISTROS", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Registros com divergências", hasData: false },
  { id: "historicoRegistros", label: "Histórico de Registros", category: "REGISTROS", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"], description: "Histórico completo de ponto", hasData: false },

  // ── RH ──
  { id: "colaboradoresAtivos", label: "Colaboradores Ativos", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Total de colaboradores ativos", hasData: false },
  { id: "presentesHoje", label: "Presentes Hoje", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Colaboradores presentes hoje", hasData: false },
  { id: "ausentesHoje", label: "Ausentes Hoje", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Colaboradores ausentes hoje", hasData: false },
  { id: "atrasadosHoje", label: "Atrasados Hoje", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Colaboradores atrasados hoje", hasData: false },
  { id: "emFerias", label: "Em Férias", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Colaboradores em férias", hasData: false },
  { id: "justificativasPendentes", label: "Justificativas Pendentes", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Justificativas aguardando análise", hasData: false },
  { id: "aprovacoesPendentes", label: "Aprovações Pendentes", category: "RH", slotType: "stat", roles: ["RH", "ADMIN", "MANAGER"], description: "Aprovações aguardando análise", hasData: false },
  { id: "fechamentosPendentes", label: "Fechamentos Pendentes", category: "RH", slotType: "stat", roles: ["RH", "ADMIN"], description: "Fechamentos de período pendentes", hasData: false },
  { id: "documentacoesPendentes", label: "Documentações Pendentes", category: "RH", slotType: "stat", roles: ["RH", "ADMIN"], description: "Documentações pendentes", hasData: false },

  // ── EQUIPE ──
  { id: "equipePresente", label: "Equipe Presente", category: "EQUIPE", slotType: "stat", roles: ["MANAGER", "ADMIN"], description: "Membros da equipe presentes", hasData: false },
  { id: "equipeAusente", label: "Equipe Ausente", category: "EQUIPE", slotType: "stat", roles: ["MANAGER", "ADMIN"], description: "Membros da equipe ausentes", hasData: false },
  { id: "horasEquipe", label: "Horas da Equipe", category: "EQUIPE", slotType: "stat", roles: ["MANAGER", "ADMIN"], description: "Total de horas da equipe", hasData: false },
  { id: "bancoEquipe", label: "Banco da Equipe", category: "EQUIPE", slotType: "stat", roles: ["MANAGER", "ADMIN"], description: "Banco de horas da equipe", hasData: false },
  { id: "solicitacoesEquipe", label: "Solicitações da Equipe", category: "EQUIPE", slotType: "stat", roles: ["MANAGER", "ADMIN"], description: "Solicitações pendentes da equipe", hasData: false },

  // ── AUDITORIA ──
  { id: "auditoriasRecentes", label: "Auditorias Recentes", category: "AUDITORIA", slotType: "medium", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Auditorias realizadas recentemente", hasData: false },
  { id: "logsAtividade", label: "Logs de Atividade", category: "AUDITORIA", slotType: "medium", roles: ["ADMIN", "DEVELOPER"], description: "Registro de atividades do sistema", hasData: false },
  { id: "registrosSuspeitos", label: "Registros Suspeitos", category: "AUDITORIA", slotType: "stat", roles: ["RH", "ADMIN", "DEVELOPER"], description: "Registros com comportamento suspeito", hasData: false },
  { id: "alertasSeguranca", label: "Alertas de Segurança", category: "AUDITORIA", slotType: "stat", roles: ["ADMIN", "DEVELOPER"], description: "Alertas de segurança do sistema", hasData: false },
  { id: "eventosCriticos", label: "Eventos Críticos", category: "AUDITORIA", slotType: "medium", roles: ["ADMIN", "DEVELOPER"], description: "Eventos críticos do sistema", hasData: false },

  // ── PRODUTIVIDADE ──
  { id: "indicadoresMensais", label: "Indicadores Mensais", category: "PRODUTIVIDADE", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN"], description: "Indicadores de produtividade mensal", hasData: false },
  { id: "taxaPresenca", label: "Taxa de Presença", category: "PRODUTIVIDADE", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN"], description: "Taxa de presença no período", hasData: false },
  { id: "horasExtrasMensais", label: "Horas Extras Mensais", category: "PRODUTIVIDADE", slotType: "stat", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN"], description: "Extras acumuladas no mês", hasData: false },
  { id: "evolucaoJornada", label: "Evolução da Jornada", category: "PRODUTIVIDADE", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN"], description: "Evolução da jornada de trabalho", hasData: false },
  { id: "tendencias", label: "Tendências", category: "PRODUTIVIDADE", slotType: "medium", roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN"], description: "Tendências de horas trabalhadas", hasData: false },

  // ── SISTEMA ──
  { id: "usuariosOnline", label: "Usuários Online", category: "SISTEMA", slotType: "stat", roles: ["DEVELOPER", "ADMIN"], description: "Usuários ativos no momento", hasData: false },
  { id: "sessoesAtivas", label: "Sessões Ativas", category: "SISTEMA", slotType: "stat", roles: ["DEVELOPER", "ADMIN"], description: "Sessões ativas no sistema", hasData: false },
  { id: "errosSistema", label: "Erros do Sistema", category: "SISTEMA", slotType: "stat", roles: ["DEVELOPER", "ADMIN"], description: "Erros reportados pelo sistema", hasData: false },
  { id: "usoApi", label: "Uso da API", category: "SISTEMA", slotType: "stat", roles: ["DEVELOPER", "ADMIN"], description: "Uso da API do sistema", hasData: false },
  { id: "usoBanco", label: "Uso do Banco", category: "SISTEMA", slotType: "stat", roles: ["DEVELOPER", "ADMIN"], description: "Uso do banco de dados", hasData: false },
  { id: "monitoramento", label: "Monitoramento", category: "SISTEMA", slotType: "medium", roles: ["DEVELOPER", "ADMIN"], description: "Monitoramento do sistema", hasData: false },
]

export const CATEGORY_ORDER: WidgetCategory[] = ["JORNADA", "REGISTROS", "RH", "EQUIPE", "AUDITORIA", "PRODUTIVIDADE", "SISTEMA"]

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  JORNADA: "Jornada",
  REGISTROS: "Registros",
  RH: "RH",
  EQUIPE: "Equipe",
  AUDITORIA: "Auditoria",
  PRODUTIVIDADE: "Produtividade",
  SISTEMA: "Sistema",
}

export function getWidgetsForRole(role: string): WidgetDef[] {
  return WIDGETS.filter(w => w.roles.includes(role as RoleType))
}

export function getWidgetsForSlot(slotType: SlotType, role: string): WidgetDef[] {
  return WIDGETS.filter(w => {
    if (!w.roles.includes(role as RoleType)) return false
    const types = Array.isArray(w.slotType) ? w.slotType : [w.slotType]
    return types.includes(slotType)
  })
}

export interface DashboardTemplate {
  id: string
  label: string
  roles: RoleType[]
  slots: SlotConfig
}

export const TEMPLATES: DashboardTemplate[] = [
  {
    id: "banco-horas",
    label: "Banco de Horas",
    roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"],
    slots: ["bancoHoras", "horasHoje", "horasExtras", "saldoAtual", "ultimosRegistros", "evolucaoBanco", "distribuicaoHoras", "metaSemanal", "pendencias"],
  },
  {
    id: "jornada",
    label: "Jornada",
    roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"],
    slots: ["horasHoje", "horasMes", "horasExtras", "saldoAtual", "metaSemanal", "evolucaoBanco", "distribuicaoHoras", "ultimosRegistros", "pendencias"],
  },
  {
    id: "produtividade",
    label: "Produtividade",
    roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"],
    slots: ["horasMes", "horasExtras", "diasTrabalhados", "pendencias", "evolucaoBanco", "distribuicaoHoras", "metaSemanal", "indicadoresMensais", "ultimosRegistros"],
  },
  {
    id: "rh-operacional",
    label: "RH Operacional",
    roles: ["RH", "ADMIN", "MANAGER"],
    slots: ["colaboradoresAtivos", "presentesHoje", "ausentesHoje", "atrasadosHoje", "justificativasPendentes", "aprovacoesPendentes", "fechamentosPendentes", "documentacoesPendentes", "ultimosRegistros"],
  },
  {
    id: "rh-estrategico",
    label: "RH Estratégico",
    roles: ["RH", "ADMIN"],
    slots: ["colaboradoresAtivos", "emFerias", "bancoHoras", "horasExtras", "indicadoresMensais", "taxaPresenca", "evolucaoBanco", "tendencias", "ultimosRegistros"],
  },
  {
    id: "rh-auditoria",
    label: "RH Auditoria",
    roles: ["RH", "ADMIN", "DEVELOPER"],
    slots: ["auditoriasRecentes", "registrosSuspeitos", "alertasSeguranca", "eventosCriticos", "logsAtividade", "ultimosRegistros", "fechamentosPendentes", "documentacoesPendentes", "monitoramento"],
  },
  {
    id: "gestao-equipe",
    label: "Gestão de Equipe",
    roles: ["MANAGER", "ADMIN"],
    slots: ["equipePresente", "equipeAusente", "horasEquipe", "bancoEquipe", "ultimosRegistros", "solicitacoesEquipe", "indicadoresMensais", "evolucaoJornada", "metaSemanal"],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    roles: ["DEVELOPER", "ADMIN"],
    slots: ["usuariosOnline", "sessoesAtivas", "errosSistema", "usoApi", "usoBanco", "monitoramento", "logsAtividade", "alertasSeguranca", "ultimosRegistros"],
  },
  {
    id: "visao-geral",
    label: "Visão Geral",
    roles: ["COLLABORATOR", "MANAGER", "RH", "ADMIN", "DEVELOPER"],
    slots: ["bancoHoras", "horasMes", "pendencias", "justificativas", "ultimosRegistros", "evolucaoBanco", "diasTrabalhados", "metaSemanal", "distribuicaoHoras"],
  },
]

export interface DashboardConfig {
  slots: SlotConfig
  templateId?: string
}

export const DEFAULT_SLOTS: SlotConfig = ["bancoHoras", "horasHoje", "horasExtras", "saldoAtual", "ultimosRegistros", "evolucaoBanco", "distribuicaoHoras", "metaSemanal", "pendencias"]

const STORAGE_KEY = "chronos-dashboard-config"

export function loadConfig(userId?: string): DashboardConfig {
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.slots && Array.isArray(parsed.slots) && parsed.slots.length === 9) {
        return parsed
      }
    }
  } catch { /* ignore */ }
  return { slots: [...DEFAULT_SLOTS] }
}

export function saveConfig(config: DashboardConfig, userId?: string): void {
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY
    localStorage.setItem(key, JSON.stringify(config))
  } catch { /* ignore */ }
}

export function findBestTemplateForSlots(slots: SlotConfig, _role: string): string | undefined {
  for (const t of TEMPLATES) {
    if (t.slots.every((id, i) => id === slots[i])) {
      return t.id
    }
  }
  return undefined
}
