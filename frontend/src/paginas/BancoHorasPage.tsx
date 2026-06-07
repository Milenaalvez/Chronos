import { useState, useMemo } from "react"
import { ChevronDown, Info } from "lucide-react"
import { PageHeader } from "../componentes/PageHeader"
import { BarChart } from "../componentes/BarChart"
import { DonutChart } from "../componentes/DonutChart"
import type { TimeRecord, Justificacao } from "../types"
import {
  formatMinutes,
  getMonthBounds,
  monthLabel,
  currentMonthISO,
  filterMonthRecords,
  computeSaldo,
  computeProjectedSaldo,
} from "../services/workHoursEngine"

interface BancoHorasPageProps {
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
}

export function BancoHorasPage({ allRecords, justificacoes }: BancoHorasPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO)

  const monthBounds = getMonthBounds(selectedMonth)

  const monthOptions = useMemo(() => {
    const set = new Set<string>()
    set.add(currentMonthISO())
    for (const r of allRecords) {
      const m = r.dataISO.slice(0, 7)
      set.add(m)
    }
    for (const iso of Object.keys(justificacoes)) {
      set.add(iso.slice(0, 7))
    }
    return Array.from(set).sort()
  }, [allRecords, justificacoes])

  const monthRecords = useMemo(() => {
    return filterMonthRecords(allRecords, monthBounds)
  }, [allRecords, monthBounds])

  const monthJustKeys = useMemo(() => {
    return Object.keys(justificacoes).filter((iso) => iso >= monthBounds.start && iso <= monthBounds.end)
  }, [justificacoes, monthBounds])

  const monthJustificacoes = useMemo(() => {
    const filtered: Record<string, Justificacao> = {}
    for (const iso of monthJustKeys) {
      filtered[iso] = justificacoes[iso]
    }
    return filtered
  }, [justificacoes, monthJustKeys])

  const saldoBase = useMemo(() => computeSaldo(monthRecords, monthJustificacoes), [monthRecords, monthJustificacoes])

  const saldoData = useMemo(() => {
    const { positiveMins, negativeMins, netSaldo, totalWorkedMins, extraMins, totalAbsences, justifiedAbsences, dailySaldo } = saldoBase
    const totalAbsenceMins = totalAbsences * 480
    const justifiedAbsenceMins = justifiedAbsences * 480
    return {
      positiveMins,
      negativeMins,
      netSaldo,
      totalWorkedMins,
      totalWorkedHours: totalWorkedMins / 60,
      extraMins,
      extraHours: extraMins / 60,
      negativeHours: negativeMins / 60,
      netHours: netSaldo / 60,
      compensatedMins: 0,
      compensatedHours: 0,
      totalAbsences,
      justifiedAbsences,
      totalAbsenceMins,
      justifiedAbsenceMins,
      cumulative: dailySaldo,
      dailySaldo,
    }
  }, [saldoBase])

  const projectedSaldo = useMemo(() => {
    return computeProjectedSaldo(saldoData.dailySaldo, saldoData.netSaldo)
  }, [saldoData])

  const evolutionData = useMemo(() => {
    const saldoByDay = new Map<string, number>()
    for (const d of saldoData.dailySaldo) {
      saldoByDay.set(d.iso, d.saldo / 60)
    }
    const days: { label: string; value: number }[] = []
    const start = new Date(monthBounds.start + "T12:00:00")
    const end = new Date(monthBounds.end + "T12:00:00")
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      days.push({
        label: iso.slice(8, 10) + "/" + iso.slice(5, 7),
        value: saldoByDay.get(iso) ?? 0,
      })
    }
    return days
  }, [saldoData, monthBounds])

  const donutData = useMemo(() => {
    const pos = saldoData.positiveMins / 60
    const neg = saldoData.negativeMins / 60
    const segments: { label: string; value: number; color: string }[] = []
    if (pos > 0.01) {
      segments.push({ label: "Saldo Positivo", value: pos, color: "#5B9B7A" })
    }
    if (neg > 0.01) {
      segments.push({ label: "Saldo Negativo", value: neg, color: "#C96B6B" })
    }
    return segments
  }, [saldoData])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Banco de Horas"
        subtitle="Acompanhe seu saldo, histórico e projeções."
        actions={
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none rounded-lg border border-default/20 bg-input text-primary text-sm font-medium px-3 py-2 pr-8 cursor-pointer outline-none hover:border-default transition-colors duration-200 focus:border-[var(--accent-ring)]"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-0">
        <div className="flex flex-col gap-1 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Saldo Atual</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B9B7A]" />
              <span className="text-[10px] font-medium text-[#5B9B7A]">ativo</span>
            </div>
          </div>
          <span className={`text-2xl font-bold tracking-tight ${saldoData.netSaldo >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
            {saldoData.netSaldo >= 0 ? "+" : ""}{formatMinutes(Math.abs(saldoData.netSaldo))}
          </span>
          <span className="text-[11px] text-secondary">{saldoData.netSaldo >= 0 ? "saldo positivo" : "saldo negativo"}</span>
        </div>

        <div className="flex flex-col gap-1 p-5">
          <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Horas Positivas</span>
          <span className="text-2xl font-bold tracking-tight text-[#5B9B7A]">+{formatMinutes(saldoData.positiveMins)}</span>
          <span className="text-[11px] text-secondary">acumulado</span>
        </div>

        <div className="flex flex-col gap-1 p-5">
          <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Horas Negativas</span>
          <span className="text-2xl font-bold tracking-tight text-[#C96B6B]">-{formatMinutes(saldoData.negativeMins)}</span>
          <span className="text-[11px] text-secondary">acumulado</span>
        </div>

        <div className="flex flex-col gap-1 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Saldo Previsto (mês)</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
              <span className="text-[10px] font-medium text-[var(--accent-primary)]">projetado</span>
            </div>
          </div>
          <span className={`text-2xl font-bold tracking-tight ${projectedSaldo >= 0 ? "text-[var(--accent-primary)]" : "text-[#C96B6B]"}`}>
            {projectedSaldo >= 0 ? "+" : ""}{formatMinutes(Math.abs(Math.round(projectedSaldo)))}
          </span>
          <span className="text-[11px] text-secondary">projeção</span>
        </div>
      </div>

      <div className="bg-elevated/50 h-px" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-primary">Saldo Diário</h3>
            <span className="text-[11px] text-secondary">Saldo de horas por dia no mês</span>
          </div>
          <div className="rounded-lg py-4 px-3 w-full overflow-x-auto">
            <BarChart data={evolutionData} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-primary">Distribuição do Saldo</h3>
            <span className="text-[11px] text-secondary">Proporção entre horas positivas e negativas</span>
          </div>
          <div className="rounded-lg py-4 px-3 w-full overflow-x-auto">
            <DonutChart
              segments={donutData}
              totalValue={saldoData.netHours}
            />
          </div>
          {donutData.length > 0 && (() => {
            const pos = saldoData.positiveMins
            const neg = saldoData.negativeMins
            const total = pos + neg
            const posPct = total > 0 ? (pos / total) * 100 : 0
            const negPct = total > 0 ? (neg / total) * 100 : 0
            return (
              <p className="text-[11px] text-secondary leading-relaxed">
                {posPct >= 70
                  ? `A maioria do saldo é positivo (${posPct.toFixed(0)}%) — bom aproveitamento da jornada.`
                  : negPct > 50
                    ? `A maioria do saldo é negativo (${negPct.toFixed(0)}%) — atenção às horas não trabalhadas.`
                    : `Distribuição: ${posPct.toFixed(0)}% positivo, ${negPct.toFixed(0)}% negativo.`}
              </p>
            )
          })()}
        </div>
      </div>

      <div className="bg-elevated/50 h-px" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-primary">Resumo do Período</h3>
              <span className="text-[11px] text-secondary">{monthLabel(selectedMonth)}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Horas Trabalhadas</span>
              <span className="text-lg font-bold text-primary tracking-tight">
                {formatMinutes(saldoData.totalWorkedMins)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Horas Extras</span>
              <span className="text-lg font-bold text-[#C49A6B] tracking-tight">
                +{formatMinutes(Math.round(saldoData.extraMins))}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Horas Negativas</span>
              <span className="text-lg font-bold text-[#C96B6B] tracking-tight">
                -{formatMinutes(Math.round(saldoData.negativeMins))}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Saldo Líquido</span>
              <span className={`text-lg font-bold tracking-tight ${saldoData.netSaldo >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
                {saldoData.netSaldo >= 0 ? "+" : ""}{formatMinutes(Math.abs(saldoData.netSaldo))}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Faltas</span>
              <span className="text-lg font-bold text-[#C49A6B] tracking-tight">
                {saldoData.totalAbsences}{saldoData.justifiedAbsences > 0 ? ` (${saldoData.justifiedAbsences} justif.)` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Média Diária</span>
              <span className="text-lg font-bold text-primary tracking-tight">
                {saldoData.cumulative.length > 0
                  ? formatMinutes(Math.round(saldoData.totalWorkedMins / Math.max(1, saldoData.cumulative.length)))
                  : "00h00m"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Dias Registrados</span>
              <span className="text-lg font-bold text-primary tracking-tight">
                {saldoData.cumulative.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Saldo Projetado</span>
              <span className={`text-lg font-bold tracking-tight ${projectedSaldo >= 0 ? "text-[var(--accent-primary)]" : "text-[#C96B6B]"}`}>
                {projectedSaldo >= 0 ? "+" : ""}{formatMinutes(Math.abs(Math.round(projectedSaldo)))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Info size={14} strokeWidth={2} className="text-muted shrink-0" />
            <span className="text-sm font-semibold text-primary">Sobre o Saldo</span>
          </div>
          <p className="text-[13px] text-secondary leading-relaxed">
            O saldo positivo pode ser utilizado conforme a política da empresa, respeitando os limites e regras estabelecidos pelo RH.
          </p>
          <div className="flex flex-col gap-2.5 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B9B7A]" />
              <span className="text-[12px] text-secondary">Horas extras acumulam saldo positivo</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C96B6B]" />
              <span className="text-[12px] text-secondary">Faltas não justificadas geram saldo negativo</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C49A6B]" />
              <span className="text-[12px] text-secondary">Justificativas aprovadas abonam o período</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
              <span className="text-[12px] text-secondary">Projeção baseada na média dos últimos dias</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
