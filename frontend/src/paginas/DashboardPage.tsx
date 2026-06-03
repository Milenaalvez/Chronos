import { useMemo, useEffect, useState } from "react"
import { TrendingUp, Clock3, Timer, CalendarDays, X, Settings2, LayoutGrid } from "lucide-react"
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
  getWidgetsForRole,
  getWidgetsForSlot,
  loadConfig,
  saveConfig,
  findBestTemplateForSlots,
  TEMPLATES,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  SLOTS,
  type DashboardConfig,
  type DashboardTemplate,
  type WidgetDef,
  type SlotType,
  type SlotConfig,
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

  const availableWidgets = useMemo(() => getWidgetsForRole(userRole), [userRole])
  const templates = useMemo(() => TEMPLATES.filter(t => t.roles.includes(userRole as any)), [userRole])

  const widgetMap = useMemo(() => {
    const m = new Map<string, WidgetDef>()
    for (const w of availableWidgets) m.set(w.id, w)
    return m
  }, [availableWidgets])

  function applySlots(slots: SlotConfig) {
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
    const slots = [...config.slots] as SlotConfig
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

  function PlaceholderWidget({ label }: { label: string }) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[120px] rounded-lg border border-dashed border-default/10 bg-elevated/5 p-6">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Em breve</span>
        <span className="text-xs text-secondary mt-1">{label}</span>
      </div>
    )
  }

  function renderCardById(cardId: string) {
    const def = widgetMap.get(cardId)
    if (!def) return null

    const recordToday = allRecords.find(r => r.dataISO === todayISO())
    const todayMins = recordToday ? Math.round(recordToday.totalHours * 60) : 0
    const hasClockIn = recordToday && recordToday.entrada !== "---"

    if (!def.hasData) {
      return <PlaceholderWidget label={def.label} />
    }

    switch (cardId) {
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
      case "diasTrabalhados":
        return (
          <StatsCard key="diasTrabalhados"
            icon={CalendarDays} title="Dias Trabalhados"
            value={String(monthStats.workedDays)}
            subtitle={workedDaysLabel}
          />
        )
      case "ultimosRegistros":
        return (
          <div key="ultimosRegistros" className="flex flex-col min-w-0">
            <RecentRecords records={allRecords} onEdit={onEdit} onNavigate={onNavigate} />
          </div>
        )
      case "evolucaoBanco":
        return (
          <div key="evolucaoBanco" className="flex flex-col min-w-0">
            <ChartCard title="Evolução do Banco de Horas" subtitle="Saldo acumulado por semana" insight={evolutionInsight}>
              <LineChart data={weekEvolution} />
            </ChartCard>
          </div>
        )
      case "distribuicaoHoras":
        return (
          <div key="distribuicaoHoras" className="flex flex-col min-w-0">
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
        )
      case "metaSemanal":
        return (
          <div key="metaSemanal" className="flex flex-col min-w-0">
            <MetaSemanal weekDays={weekDays} monthTotalMins={monthStats.totalMins} monthRecords={monthRecordsStrict} />
          </div>
        )
      default:
        return <PlaceholderWidget label={def.label} />
    }
  }

  function renderSlot(slotIndex: number) {
    const cardId = config.slots[slotIndex]
    const def = widgetMap.get(cardId)
    if (!def) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[80px] rounded-lg border border-dashed border-default/10 bg-elevated/5 p-4">
          <span className="text-[10px] text-muted">Selecione um widget</span>
        </div>
      )
    }
    return renderCardById(cardId)
  }

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

      {/* Row 1: 4 stat slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {renderSlot(0)}
        {renderSlot(1)}
        {renderSlot(2)}
        {renderSlot(3)}
      </div>

      {/* Row 2: 2 medium slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="flex flex-col min-w-0">
          {renderSlot(4)}
        </div>
        <div className="flex flex-col min-w-0">
          {renderSlot(5)}
        </div>
      </div>

      {/* Row 3: 2 medium slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="flex flex-col min-w-0">
          {renderSlot(6)}
        </div>
        <div className="flex flex-col min-w-0">
          {renderSlot(7)}
        </div>
      </div>

      {/* Row 4: 1 wide slot */}
      <div className="grid grid-cols-1">
        {renderSlot(8)}
      </div>

      {/* Personalization Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-3xl mx-4 bg-surface border border-default/40 rounded-xl p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/[0.07] transition-all duration-200"
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-col gap-1 mb-8">
              <h2 className="text-xl font-bold text-primary tracking-tight">Personalizar Dashboard</h2>
              <p className="text-sm text-secondary">Escolha os widgets para cada posição do seu dashboard.</p>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
              <div className="mb-8">
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
              {config.slots.map((cardId, i) => {
                const slotDef = SLOTS[i]
                const compatibleWidgets = getWidgetsForSlot(slotDef.slotType as SlotType, userRole)
                return (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-elevated/20 border border-default/10">
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-[var(--accent-primary)]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                          {slotDef.label}
                        </p>
                        <span className="text-[9px] font-medium text-muted bg-elevated/30 px-1.5 py-0.5 rounded">
                          {slotDef.slotType === "stat" ? "Indicador" : slotDef.slotType === "medium" ? "Widget" : "Painel"}
                        </span>
                      </div>
                      <div className="relative">
                        <select
                          value={cardId}
                          onChange={e => setSlot(i, e.target.value)}
                          className="w-full appearance-none h-9 px-3 rounded-lg bg-input border border-default/20 text-xs text-primary font-medium outline-none focus:border-[var(--accent-ring)] cursor-pointer"
                        >
                          {CATEGORY_ORDER.map(cat => {
                            const catWidgets = compatibleWidgets.filter(w => w.category === cat)
                            if (catWidgets.length === 0) return null
                            return (
                              <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                                {catWidgets.map(w => (
                                  <option key={w.id} value={w.id}>
                                    {w.label}{w.hasData ? "" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          })}
                        </select>
                      </div>
                      <p className="text-[10px] text-muted mt-1.5">
                        {widgetMap.get(cardId)?.description || "Selecione um widget"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-3 pt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 h-10 rounded-lg bg-surface border border-default/50 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => setModalOpen(false)}
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
