import { useMemo, useEffect, useState } from "react"
import { TrendingUp, Clock3, Timer, CalendarDays, X } from "lucide-react"
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

interface DashboardPageProps {
  records: TimeRecord[]
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
  onEdit: (dataISO: string) => void
  onNavigate?: (page: string) => void
  user?: { name: string; position?: string | null; hireDate?: string }
}

export function DashboardPage({ records: _records, allRecords, justificacoes = {}, onEdit, onNavigate, user }: DashboardPageProps) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    return sessionStorage.getItem("chronos-welcome-dismissed") === "true"
  })

  useEffect(() => {
    if (welcomeDismissed) {
      sessionStorage.setItem("chronos-welcome-dismissed", "true")
    }
  }, [welcomeDismissed])

  const isNewUser = !welcomeDismissed && user?.hireDate && allRecords.length === 0

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
  const normalHours = (totalMins - extraMins) / 60
  const extraHours = extraMins / 60
  const normalMins = totalMins - extraMins
  const baselineMins = workedDays * 480
  const negativoHours = Math.max(0, baselineMins - normalMins) / 60

  const workedDaysLabel = monthStats.workedDays === 1 ? "dia trabalhado" : "dias trabalhados"

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Olá, ${user?.name || "Usuário"}`}
        subtitle={
          user?.position
            ? `${user.position} — ${periodLabel}`
            : periodLabel
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
        <StatsCard
          icon={TrendingUp}
          title="Saldo de Horas"
          value={saldoDisplay}
          subtitle="Saldo acumulado"
          trend={saldoData.netSaldo >= 0 ? "up" : "down"}
          trendValue={saldoData.netSaldo >= 0 ? "positivo" : "negativo"}
        />
        <StatsCard
          icon={Clock3}
          title="Horas Trabalhadas"
          value={formatMinutes(Math.round(monthStats.totalMins))}
          subtitle={monthLabelClean}
        />
        <StatsCard
          icon={Timer}
          title="Horas Extras"
          value={formatMinutes(Math.round(monthStats.extraMins))}
          subtitle={monthLabelClean}
          trend={monthStats.extraMins > 0 ? "up" : undefined}
          trendValue={monthStats.extraMins > 0 ? "acumulado" : undefined}
        />
        <StatsCard
          icon={CalendarDays}
          title="Dias Trabalhados"
          value={String(monthStats.workedDays)}
          subtitle={workedDaysLabel}
        />
      </div>

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
    </div>
  )
}
