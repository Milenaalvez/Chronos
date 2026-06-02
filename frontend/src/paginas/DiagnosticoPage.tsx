import { useMemo } from "react"
import type { TimeRecord, Justificacao } from "../types"
import { formatMinutes } from "../types"
import {
  computeSaldo,
  computeMonthStats,
  computeFilteredTotals,
  filterMonthRecords,
  filterMonthRecordsStrict,
  getMonthBounds,
  formatSaldoDisplay,
  computeProjectedSaldo,
  computeAbsences,
  computeTotalMins,
  computeExtraMins,
  computeWorkedDays,
} from "../services/workHoursEngine"

interface DiagnosticoPageProps {
  allRecords: TimeRecord[]
  records: TimeRecord[]
  justificacoes: Record<string, Justificacao>
}

export function DiagnosticoPage({ allRecords, records: _records, justificacoes }: DiagnosticoPageProps) {
  const monthBounds = getMonthBounds()
  const monthRecords = useMemo(() => filterMonthRecords(allRecords, monthBounds), [allRecords])
  const monthRecordsStrict = useMemo(() => filterMonthRecordsStrict(allRecords, monthBounds), [allRecords])

  const saldoAll = useMemo(() => computeSaldo(allRecords, justificacoes), [allRecords, justificacoes])
  const saldoMonth = useMemo(() => computeSaldo(monthRecords, justificacoes), [monthRecords, justificacoes])

  const statsStrict = useMemo(() => computeMonthStats(monthRecordsStrict), [monthRecordsStrict])
  const totalsMonth = useMemo(() => computeFilteredTotals(monthRecords), [monthRecords])
  const projected = useMemo(() => computeProjectedSaldo(saldoMonth.dailySaldo, saldoMonth.netSaldo), [saldoMonth])

  const monthWeekdayISOs = useMemo(() => {
    const days: string[] = []
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const todayStr = now.toISOString().split("T")[0]
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d)
      if (date.getDay() === 0 || date.getDay() === 6) continue
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      if (iso > todayStr) break
      days.push(iso)
    }
    return days
  }, [])
  const absences = useMemo(() => computeAbsences(allRecords, monthWeekdayISOs, justificacoes), [allRecords, monthWeekdayISOs, justificacoes])

  const totalMinsEngine = computeTotalMins(monthRecords)
  const extraMinsEngine = computeExtraMins(monthRecords)
  const workedDaysEngine = computeWorkedDays(monthRecords)

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <h1 className="text-lg font-bold text-primary">Diagnóstico — Motor de Cálculo</h1>
        <span className="text-[10px] text-muted font-mono">workHoursEngine.ts</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-default/20 p-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Registros</span>
          <div className="text-xs font-mono text-secondary space-y-1">
            <p>Total (allRecords): <span className="text-primary font-semibold">{allRecords.length}</span></p>
            <p>Mês (monthRecords): <span className="text-primary font-semibold">{monthRecords.length}</span></p>
            <p>Mês (strict): <span className="text-primary font-semibold">{monthRecordsStrict.length}</span></p>
            <p>Pendentes no mês: <span className="text-primary font-semibold">{monthRecords.filter(r => r.tipo === "Pendente").length}</span></p>
          </div>
        </div>

        <div className="rounded-lg border border-default/20 p-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Saldo (computeSaldo)</span>
          <div className="text-xs font-mono text-secondary space-y-1">
            <p>Saldo total: <span className="text-primary font-semibold">{formatSaldoDisplay(saldoAll.netSaldo)}</span></p>
            <p>Saldo mês: <span className="text-primary font-semibold">{formatSaldoDisplay(saldoMonth.netSaldo)}</span></p>
            <p>Positivo mês: <span className="text-primary font-semibold">{formatMinutes(saldoMonth.positiveMins)}</span></p>
            <p>Negativo mês: <span className="text-primary font-semibold">{formatMinutes(saldoMonth.negativeMins)}</span></p>
            <p>Extra mês: <span className="text-primary font-semibold">{formatMinutes(saldoMonth.extraMins)}</span></p>
            <p>Trabalhado mês: <span className="text-primary font-semibold">{formatMinutes(saldoMonth.totalWorkedMins)}</span></p>
          </div>
        </div>

        <div className="rounded-lg border border-default/20 p-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Mês (computeMonthStats/FilteredTotals)</span>
          <div className="text-xs font-mono text-secondary space-y-1">
            <p>totalMins (stats): <span className="text-primary font-semibold">{formatMinutes(statsStrict.totalMins)}</span></p>
            <p>totalMins (filtered): <span className="text-primary font-semibold">{formatMinutes(totalsMonth.totalMins)}</span></p>
            <p>extraMins (filtered): <span className="text-primary font-semibold">{formatMinutes(totalsMonth.extraMins)}</span></p>
            <p>workedDays (filtered): <span className="text-primary font-semibold">{totalsMonth.workedDays}</span></p>
            <p>Projeção: <span className="text-primary font-semibold">{formatMinutes(Math.round(Math.abs(projected)))}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-default/20 p-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Engine Functions</span>
          <div className="text-xs font-mono text-secondary space-y-1">
            <p>computeTotalMins: <span className="text-primary font-semibold">{formatMinutes(totalMinsEngine)}</span></p>
            <p>computeExtraMins: <span className="text-primary font-semibold">{formatMinutes(extraMinsEngine)}</span></p>
            <p>computeWorkedDays: <span className="text-primary font-semibold">{workedDaysEngine}</span></p>
          </div>
        </div>

        <div className="rounded-lg border border-default/20 p-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Faltas (computeAbsences)</span>
          <div className="text-xs font-mono text-secondary space-y-1">
            <p>Total: <span className="text-primary font-semibold">{absences.faltasCount}</span></p>
            <p>Justificadas: <span className="text-primary font-semibold">{absences.justificadasCount}</span></p>
            <p>Não justificadas: <span className="text-primary font-semibold">{absences.naoJustificadasCount}</span></p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-default/20 overflow-hidden">
        <div className="p-3 bg-elevated/30 border-b border-default/20">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Origem: computeSaldo → dailySaldo</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-default/20 text-muted">
                <th className="text-left p-2 font-semibold">Data</th>
                <th className="text-right p-2 font-semibold">Saldo (min)</th>
                <th className="text-right p-2 font-semibold">Acumulado (min)</th>
                <th className="text-right p-2 font-semibold">Acumulado (h)</th>
              </tr>
            </thead>
            <tbody>
              {saldoAll.dailySaldo.slice(-20).map((d) => (
                <tr key={d.iso} className="border-b border-default/10">
                  <td className="p-2 text-primary">{d.label}</td>
                  <td className={`p-2 text-right ${d.saldo >= 0 ? "text-green-500" : "text-red-500"}`}>{d.saldo}</td>
                  <td className={`p-2 text-right ${d.cumulative >= 0 ? "text-green-500" : "text-red-500"}`}>{d.cumulative}</td>
                  <td className={`p-2 text-right ${d.cumulative >= 0 ? "text-green-500" : "text-red-500"}`}>{(d.cumulative / 60).toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[10px] text-muted font-mono border-t border-default/20 pt-4">
        <p>Record count check: allRecords={allRecords.length} | monthRecords={monthRecords.length} | monthStrict={monthRecordsStrict.length}</p>
        <p>Justificativas: {Object.keys(justificacoes).length}</p>
      </div>
    </div>
  )
}
