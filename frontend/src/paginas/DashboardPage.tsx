import { useMemo, useEffect, useState } from "react"
import { TrendingUp, Clock3, Timer, CalendarDays, X, Settings2, LayoutGrid, ChevronDown } from "lucide-react"
import { StatsCard } from "../componentes/StatsCard"
import { ChartCard } from "../componentes/ChartCard"
import { RecentRecords } from "../componentes/RecentRecords"
import { MetaSemanal } from "../componentes/MetaSemanal"
import { LineChart } from "../componentes/LineChart"
import { DonutChart } from "../componentes/DonutChart"
import { PageHeader } from "../componentes/PageHeader"
import type { TimeRecord, Justificacao } from "../types"
import {
  formatMinutes,
  getMonthBounds,
  filterMonthRecords,
  filterMonthRecordsStrict,
  computeSaldo,
  computeMonthStats,
  monthLabel,
  currentMonthISO,
  formatSaldoDisplay,
  computeWeekEvolution,
  computeWeekDays,
  computeFilteredTotals,
} from "../services/workHoursEngine"
import {
  getCardsForRole,
  getTemplatesForRole,
  loadConfig,
  saveConfig,
  findBestTemplateForSlots,
  type DashboardConfig,
  type DashboardCardDef,
  type DashboardTemplate,
} from "../services/dashboardCards"

interface DashboardPageProps {
  records: TimeRecord[]
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
  onEdit: (dataISO: string) => void
  onNavigate?: (page: string) => void
  user?: { name: string; position?: string | null; hireDate?: string; role?: string }
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]
}

export function DashboardPage({ records: _records, allRecords, justificacoes = {}, onEdit, onNavigate, user }: DashboardPageProps) {
  const userRole = user?.role || "COLLABORATOR"
  const userId = user?.name || "default"

  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    return sessionStorage.getItem("chronos-welcome-dismissed") === "true"
  })

  useEffect(() => {
    if (welcomeDismissed) {
      sessionStorage.setItem("chronos-welcome-dismissed", "true")
    }
  }, [welcomeDismissed])

  const isNewUser = !welcomeDismissed && user?.hireDate && allRecords.length === 0

  const [config, setConfig] = useState<DashboardConfig>(() => loadConfig(userId))
  const [modalOpen, setModalOpen] = useState(false)

  const availableCards = useMemo(() => getCardsForRole(userRole), [userRole])
  const templates = useMemo(() => getTemplatesForRole(userRole), [userRole])

  const cardMap = useMemo(() => {
    const m = new Map<string, DashboardCardDef>()
    for (const c of availableCards) m.set(c.id, c)
    return m
  }, [availableCards])

  function applySlots(slots: [string, string, string, string]) {
    const templateId = findBestTemplateForSlots(slots, userRole)
    const c: DashboardConfig = { slots, templateId }
    setConfig(c)
    saveConfig(c, userId)
  }

  function applyTemplate(t: DashboardTemplate) {
    const c: DashboardConfig = { slots: t.slots, templateId: t.id }
    setConfig(c)
    saveConfig(c, userId)
  }

  function setSlot(index: number, cardId: string) {
    const slots = [...config.slots] as [string, string, string, string]
    slots[index] = cardId
    applySlots(slots)
  }

  const monthBounds = useMemo(() => getMonthBounds(), [])
  const periodLabel = monthLabel(currentMonthISO())
  const monthLabelClean = "No mês atual"

  const weekDays = useMemo(() => computeWeekDays(allRecords), [allRecords])
  const weekEvolution = useMemo(() => computeWeekEvolution(allRecords), [allRecords])

  const evolutionInsight = useMemo(() => {
    if (weekEvolution.length < 2) return undefined
    const first = weekEvolution[0].value
    const last = weekEvolution[weekEvolution.length - 1].value
    const diff = last - first
    if (Math.abs(diff) < 0.1) return "Seu banco de horas se manteve estável esta semana."
    const pct = first !== 0 ? ((diff / Math.abs(first)) * 100).toFixed(0) : diff.toFixed(1)
    return diff > 0
      ? `Seu banco de horas aumentou +${diff.toFixed(1)}h (${pct}%) esta semana.`
      : `Seu banco de horas reduziu ${Math.abs(diff).toFixed(1)}h (${pct}%) esta semana.`
  }, [weekEvolution])

  const monthRecordsStrict = useMemo(() => filterMonthRecordsStrict(allRecords, monthBounds), [allRecords, monthBounds])
  const monthRecords = useMemo(() => filterMonthRecords(allRecords, monthBounds), [allRecords, monthBounds])
  const monthStats = useMemo(() => computeMonthStats(monthRecords), [monthRecords])
  const saldoData = useMemo(() => computeSaldo(monthRecords, justificacoes), [monthRecords, justificacoes])
  const saldoDisplay = formatSaldoDisplay(saldoData.netSaldo)
  const filteredTotals = useMemo(() => computeFilteredTotals(monthRecords), [monthRecords])
  const { totalMins, extraMins, workedDays } = filteredTotals
  const normalMins = totalMins - extraMins
  const baselineMins = workedDays * 480
  const negativoHours = Math.max(0, baselineMins - normalMins) / 60
  const normalHours = normalMins / 60
  const extraHours = extraMins / 60

  const workedDaysLabel = monthStats.workedDays === 1 ? "dia trabalhado" : "dias trabalhados"

  function renderSlotCard(cardId: string, idx: number) {
    const def = cardMap.get(cardId)
    if (!def) return null
    return renderCardById(cardId, idx)
  }

  function renderCardById(cardId: string, _idx: number) {
    const recordToday = allRecords.find(r => r.dataISO === todayISO())
    const todayMins = recordToday ? Math.round(recordToday.totalHours * 60) : 0
    const hasClockIn = recordToday && recordToday.entrada !== "---"

    switch (cardId) {
      // ── Collaborator ──────────────────────────────
      case "bancoHoras":
        return (
          <StatsCard key="bancoHoras"
            icon={TrendingUp} title="Banco de Horas" value={saldoDisplay}
            subtitle="Saldo acumulado"
            trend={saldoData.netSaldo >= 0 ? "up" : "down"}
            trendValue={saldoData.netSaldo >= 0 ? "positivo" : "negativo"}
          />
        )
      case "horasHoje":
        return (
          <StatsCard key="horasHoje"
            icon={Clock3} title="Horas Hoje"
            value={hasClockIn ? formatMinutes(todayMins) : "---"}
            subtitle={hasClockIn ? "Trabalhadas hoje" : "Nenhum registro"}
          />
        )
      case "horasMes":
        return (
          <StatsCard key="horasMes"
            icon={Clock3} title="Horas no Mês"
            value={formatMinutes(Math.round(monthStats.totalMins))}
            subtitle={monthLabelClean}
          />
        )
      case "horasExtras":
        return (
          <StatsCard key="horasExtras"
            icon={Timer} title="Horas Extras"
            value={formatMinutes(Math.round(monthStats.extraMins))}
            subtitle={monthLabelClean}
            trend={monthStats.extraMins > 0 ? "up" : undefined}
            trendValue={monthStats.extraMins > 0 ? "acumulado" : undefined}
          />
        )
      case "saldoAtual":
        return (
          <StatsCard key="saldoAtual"
            icon={TrendingUp} title="Saldo Atual" value={saldoDisplay}
            subtitle={saldoData.netSaldo >= 0 ? "positivo" : "negativo"}
            trend={saldoData.netSaldo >= 0 ? "up" : "down"}
            trendValue={saldoData.netSaldo >= 0 ? "positivo" : "negativo"}
          />
        )
      case "ultimosRegistros":
        return (
          <div key="ultimosRegistros" className="lg:col-span-2 flex flex-col gap-5 min-w-0">
            <RecentRecords records={allRecords} onEdit={onEdit} onNavigate={onNavigate} />
          </div>
        )
      case "calendarioResumido":
        return (
          <div key="calendarioResumido" className="flex flex-col gap-5 min-w-0">
            <ChartCard title="Evolução do Banco de Horas" subtitle="Saldo acumulado por semana" insight={evolutionInsight}>
              <LineChart data={weekEvolution} />
            </ChartCard>
          </div>
        )
      case "pendencias":
        return (
          <StatsCard key="pendencias"
            icon={Timer} title="Pendências"
            value={String(allRecords.filter(r => r.tipo === "Pendente").length)}
            subtitle="Registros em aberto"
          />
        )
      case "justificativas":
        return (
          <StatsCard key="justificativas"
            icon={Timer} title="Justificativas"
            value={String(Object.keys(justificacoes).length)}
            subtitle={Object.keys(justificacoes).length === 1 ? "Registrada" : "Registradas"}
          />
        )
      case "proximasFerias":
        return (
          <StatsCard key="proximasFerias"
            icon={CalendarDays} title="Próximas Férias"
            value={user?.hireDate ? "---" : "---"}
            subtitle={user?.hireDate ? "Consulte o RH" : "Data não informada"}
          />
        )
      case "notificacoes":
        return (
          <StatsCard key="notificacoes"
            icon={Timer} title="Notificações" value="0"
            subtitle="Nenhuma notificação"
          />
        )
      case "historicoAtividades":
        return (
          <StatsCard key="historicoAtividades"
            icon={Clock3} title="Dias Registrados"
            value={String(monthStats.workedDays)}
            subtitle={workedDaysLabel}
          />
        )

      // ── Manager / RH / Developer shared ────────────
      case "aprovacoesPendentes":
        return (
          <StatsCard key="aprovacoesPendentes"
            icon={Timer} title="Aprovações Pendentes" value="0"
            subtitle="Nenhuma pendente"
          />
        )
      case "justificativasPendentes":
        return (
          <StatsCard key="justificativasPendentes"
            icon={Timer} title="Justificativas Pendentes"
            value={String(Object.values(justificacoes).filter(j => j.status === "em_analise").length)}
            subtitle="Em análise"
          />
        )
      case "solicitacoesPendentes":
        return (
          <StatsCard key="solicitacoesPendentes"
            icon={Timer} title="Solicitações Pendentes" value="0"
            subtitle="Nenhuma pendente"
          />
        )

      // ── Manager ────────────────────────────────────
      case "colaboradoresPresentes":
        return (
          <StatsCard key="colaboradoresPresentes"
            icon={TrendingUp} title="Colaboradores Presentes" value="0"
            subtitle="Hoje"
          />
        )
      case "colaboradoresAusentes":
        return (
          <StatsCard key="colaboradoresAusentes"
            icon={TrendingUp} title="Colaboradores Ausentes" value="0"
            subtitle="Hoje"
          />
        )
      case "colaboradoresAtrasados":
        return (
          <StatsCard key="colaboradoresAtrasados"
            icon={TrendingUp} title="Colaboradores Atrasados" value="0"
            subtitle="Hoje"
          />
        )
      case "bancoHorasEquipe":
        return (
          <StatsCard key="bancoHorasEquipe"
            icon={TrendingUp} title="Banco de Horas (Equipe)" value="---"
            subtitle="Saldo da equipe"
          />
        )
      case "horasExtrasEquipe":
        return (
          <StatsCard key="horasExtrasEquipe"
            icon={Timer} title="Horas Extras (Equipe)" value="---"
            subtitle="Acumuladas"
          />
        )
      case "equipeFerias":
        return (
          <StatsCard key="equipeFerias"
            icon={CalendarDays} title="Equipe em Férias" value="0"
            subtitle="Nenhum"
          />
        )
      case "produtividadeEquipe":
        return (
          <StatsCard key="produtividadeEquipe"
            icon={TrendingUp} title="Produtividade (Equipe)" value="---"
            subtitle="Indisponível"
          />
        )
      case "ultimosRegistrosEquipe":
        return (
          <StatsCard key="ultimosRegistrosEquipe"
            icon={Clock3} title="Registros (Equipe)" value="---"
            subtitle="Hoje"
          />
        )
      case "alertasEquipe":
        return (
          <StatsCard key="alertasEquipe"
            icon={Timer} title="Alertas (Equipe)" value="0"
            subtitle="Nenhum alerta"
          />
        )

      // ── RH / Admin / Developer ─────────────────────
      case "totalColaboradores":
        return (
          <StatsCard key="totalColaboradores"
            icon={TrendingUp} title="Total de Colaboradores" value="---"
            subtitle="Indisponível"
          />
        )
      case "colaboradoresAtivos":
        return (
          <StatsCard key="colaboradoresAtivos"
            icon={TrendingUp} title="Colaboradores Ativos" value="---"
            subtitle="Indisponível"
          />
        )
      case "presentesHoje":
        return (
          <StatsCard key="presentesHoje"
            icon={TrendingUp} title="Presentes Hoje" value="---"
            subtitle="Indisponível"
          />
        )
      case "ausentesHoje":
        return (
          <StatsCard key="ausentesHoje"
            icon={TrendingUp} title="Ausentes Hoje" value="---"
            subtitle="Indisponível"
          />
        )
      case "atrasadosHoje":
        return (
          <StatsCard key="atrasadosHoje"
            icon={TrendingUp} title="Atrasados Hoje" value="---"
            subtitle="Indisponível"
          />
        )
      case "emFerias":
        return (
          <StatsCard key="emFerias"
            icon={CalendarDays} title="Em Férias" value="---"
            subtitle="Indisponível"
          />
        )
      case "bancoNegativo":
        return (
          <StatsCard key="bancoNegativo"
            icon={TrendingUp} title="Banco Negativo" value="---"
            subtitle="Indisponível"
          />
        )
      case "horasExtrasEmpresa":
        return (
          <StatsCard key="horasExtrasEmpresa"
            icon={Timer} title="Horas Extras (Empresa)" value="---"
            subtitle="Indisponível"
          />
        )
      case "fechamentosPendentes":
        return (
          <StatsCard key="fechamentosPendentes"
            icon={Timer} title="Fechamentos Pendentes" value="---"
            subtitle="Indisponível"
          />
        )
      case "documentacoesPendentes":
        return (
          <StatsCard key="documentacoesPendentes"
            icon={Timer} title="Documentações Pendentes" value="---"
            subtitle="Indisponível"
          />
        )
      case "solicitacoesFerias":
        return (
          <StatsCard key="solicitacoesFerias"
            icon={CalendarDays} title="Solicitações de Férias" value="---"
            subtitle="Indisponível"
          />
        )
      case "auditoriasRecentes":
        return (
          <StatsCard key="auditoriasRecentes"
            icon={Timer} title="Auditorias Recentes" value="---"
            subtitle="Indisponível"
          />
        )
      case "indicadoresPresenca":
        return (
          <StatsCard key="indicadoresPresenca"
            icon={TrendingUp} title="Indicadores de Presença" value="---"
            subtitle="Indisponível"
          />
        )
      case "indicadoresMensais":
        return (
          <StatsCard key="indicadoresMensais"
            icon={CalendarDays} title="Indicadores Mensais" value="---"
            subtitle="Indisponível"
          />
        )

      // ── Developer ───────────────────────────────────
      case "usuariosOnline":
      case "sessoesAtivas":
      case "logsRecentes":
      case "errosSistema":
      case "usoBancoDados":
      case "usoApi":
      case "performance":
      case "jobsExecutados":
      case "integracoes":
      case "alertasTecnicos":
      case "monitoramento":
        return (
          <StatsCard key={cardId}
            icon={Timer} title={cardMap.get(cardId)?.label || cardId} value="---"
            subtitle="Indisponível"
          />
        )

      default:
        return (
          <StatsCard key={cardId}
            icon={Timer} title={cardMap.get(cardId)?.label || cardId} value="---"
            subtitle="Indisponível"
          />
        )
    }
  }

  const slot1 = renderSlotCard(config.slots[0], 0)
  const slot2 = renderSlotCard(config.slots[1], 1)
  const slot3 = renderSlotCard(config.slots[2], 2)
  const slot4 = renderSlotCard(config.slots[3], 3)

  const isWideSlot = (cardId: string) => cardId === "ultimosRegistros" || cardId === "calendarioResumido"

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Olá, ${user?.name || "Usuário"}`}
        subtitle={
          user?.position
            ? `${user.position} — ${periodLabel}`
            : periodLabel
        }
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-elevated/40 border border-default/20 text-[11px] font-semibold text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            <Settings2 size={13} />
            Personalizar Dashboard
          </button>
        }
      />

      {isNewUser && (
        <div className="relative rounded-xl border border-[var(--accent-primary)]/20 bg-gradient-to-br from-[var(--accent-primary)]/5 to-transparent p-6">
          <button
            onClick={() => setWelcomeDismissed(true)}
            className="absolute top-3 right-3 md:w-11 md:h-11 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/50 transition-all duration-200"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <div className="flex flex-col gap-2 max-w-full sm:max-w-lg">
            <h2 className="text-lg font-bold text-primary">Bem-vindo(a) ao Chronos!</h2>
            <p className="text-sm text-secondary leading-relaxed">
              Sua jornada foi iniciada hoje.
              Seu banco de horas está zerado e seus registros começarão a ser contabilizados a partir da sua data de admissão.
            </p>
          </div>
        </div>
      )}

      <div className={`grid ${isWideSlot(config.slots[0]) || isWideSlot(config.slots[1]) ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0"}`}>
        {slot1}
        {!isWideSlot(config.slots[0]) && slot2}
        {!isWideSlot(config.slots[0]) && slot3}
        {!isWideSlot(config.slots[0]) && slot4}
      </div>

      {isWideSlot(config.slots[0]) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {slot2 && <div className="flex flex-col gap-5 min-w-0">{slot2}</div>}
          {slot3 && <div className="flex flex-col gap-5 min-w-0">{slot3}</div>}
        </div>
      )}

      <div className="bg-elevated/50 h-px" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="flex flex-col gap-5 min-w-0">
          <ChartCard title="Evolução do Banco de Horas" subtitle="Saldo acumulado por semana" insight={evolutionInsight}>
            <LineChart data={weekEvolution} />
          </ChartCard>
        </div>
        <div className="flex flex-col gap-5 min-w-0">
          <ChartCard title="Distribuição de Horas" subtitle="Total do período atual">
            <DonutChart
              segments={[
                { label: "Horário Normal", value: normalHours, color: "#8AAEE0" },
                { label: "Horas Extras", value: extraHours, color: "#628ECB" },
                { label: "Banco Negativo", value: negativoHours, color: "#C96B6C" },
              ]}
              totalValue={normalHours + extraHours + negativoHours}
            />
          </ChartCard>
        </div>
      </div>

      <div className="bg-elevated/50 h-px" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <RecentRecords records={allRecords} onEdit={onEdit} onNavigate={onNavigate} />
        <MetaSemanal weekDays={weekDays} monthTotalMins={monthStats.totalMins} monthRecords={monthRecordsStrict} />
      </div>

      {/* Personalization Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-2xl mx-4 bg-surface border border-default/40 rounded-xl p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/[0.07] transition-all duration-200"
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-col gap-1 mb-8">
              <h2 className="text-xl font-bold text-primary tracking-tight">Personalizar Dashboard</h2>
              <p className="text-sm text-secondary">Escolha qual card exibir em cada posição do dashboard.</p>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid size={14} className="text-muted" />
                  <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Modelos Prontos</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                        config.templateId === t.id
                          ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]"
                          : "bg-elevated/30 border-default/20 text-secondary hover:text-primary hover:border-default"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Slots */}
            <div className="flex flex-col gap-4">
              {config.slots.map((cardId, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-elevated/20 border border-default/10">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[var(--accent-primary)]">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Posição {i + 1}</p>
                    <div className="relative">
                      <select
                        value={cardId}
                        onChange={e => setSlot(i, e.target.value)}
                        className="w-full appearance-none h-9 px-3 rounded-lg bg-input border border-default/20 text-xs text-primary font-medium outline-none focus:border-[var(--accent-ring)] cursor-pointer"
                      >
                        {availableCards.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-muted mt-1">{cardMap.get(cardId)?.description || ""}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 h-10 rounded-lg bg-surface border border-default/50 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all"
              >
                Fechar
              </button>
              <button
                onClick={() => { setModalOpen(false) }}
                className="flex-1 h-10 rounded-lg bg-[var(--accent-primary)] text-xs font-bold text-white hover:brightness-110 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
