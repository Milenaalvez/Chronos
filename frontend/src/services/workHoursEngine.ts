import type { TimeRecord, Justificacao } from "../types"
import { formatMinutes, toMinutes } from "../types"
import {
  getMonthBounds,
  currentMonthISO,
  monthLabel,
  isWeekday,
  getMondayOfWeek,
  filterMonthRecords,
  filterMonthRecordsStrict,
  computeSaldo,
  computeMonthStats,
} from "./calculo-horas"

export { formatMinutes, toMinutes }
export {
  getMonthBounds,
  currentMonthISO,
  monthLabel,
  isWeekday,
  getMondayOfWeek,
  filterMonthRecords,
  filterMonthRecordsStrict,
  computeSaldo,
  computeMonthStats,
}

export type { SaldoResult, SimpleMonthStats } from "./calculo-horas"

const STD_DAY_HOURS = 8
const STD_DAY_MINS = STD_DAY_HOURS * 60

/**
 * Central place to format saldo for display.
 * Returns string like "+02h30m" or "-01h15m" or "00h00m".
 */
export function formatSaldoDisplay(netSaldo: number): string {
  if (netSaldo === 0) return "00h00m"
  return formatMinutes(netSaldo)
}

/**
 * Compute the total worked minutes from a list of records.
 * Replaces inline `records.reduce((s,r) => s + r.totalHours, 0)` patterns.
 */
export function computeTotalMins(records: TimeRecord[]): number {
  return records.reduce((s, r) => s + r.totalHours * 60, 0)
}

/**
 * Compute total extra minutes from a list of records.
 * Replaces inline `records.reduce((s,r) => s + Math.max((r.totalHours - 8) * 60, 0), 0)`.
 */
export function computeExtraMins(records: TimeRecord[]): number {
  return records.reduce((s, r) => s + Math.max((r.totalHours - STD_DAY_HOURS) * 60, 0), 0)
}

/**
 * Count unique worked days (non-Pendente) from a list of records.
 */
export function computeWorkedDays(records: TimeRecord[], justificacoes?: Record<string, Justificacao>): number {
  const daySet = new Set(records.filter((r) => !(r.tipo === "Pendente" && r.entrada === "---")).map((r) => r.dataISO))
  if (justificacoes) {
    for (const r of records) {
      if (r.tipo === "Pendente" && r.entrada === "---") {
        const j = justificacoes[r.dataISO]
        if (j && j.status === "aprovado") {
          daySet.add(r.dataISO)
        }
      }
    }
  }
  return daySet.size
}

/**
 * Returns the daily balance in minutes for a single record: (totalHours - 8) * 60.
 * Used by Calendario and DayDetailModal.
 */
export function computeDayBalanceMins(record: TimeRecord): number {
  return Math.round((record.totalHours - STD_DAY_HOURS) * 60)
}

/**
 * Compute filtered totals for any record set.
 * Returns { totalMins, extraMins, workedDays } in a single pass.
 */
export function computeFilteredTotals(records: TimeRecord[], justificacoes?: Record<string, Justificacao>): {
  totalMins: number
  extraMins: number
  workedDays: number
} {
  let totalMins = 0
  let extraMins = 0
  const daySet = new Set<string>()
  for (const r of records) {
    const mins = r.totalHours * 60
    totalMins += mins
    extraMins += Math.max(mins - STD_DAY_MINS, 0)
    if (r.tipo !== "Pendente" || r.entrada !== "---") {
      daySet.add(r.dataISO)
    } else if (justificacoes) {
      const j = justificacoes[r.dataISO]
      if (j && j.status === "aprovado") {
        totalMins += STD_DAY_MINS
        daySet.add(r.dataISO)
      }
    }
  }
  return { totalMins, extraMins, workedDays: daySet.size }
}

/**
 * Weekly cumulative balance evolution (last 5 weeks).
 * Replaces DashboardPage's inline `computeWeeklyEvolution`.
 */
export function computeWeekEvolution(records: TimeRecord[]): { label: string; value: number }[] {
  const weekMap = new Map<string, number>()
  for (const r of records) {
    if ((r.tipo === "Pendente" && r.entrada === "---") || !r.dataISO) continue
    const weekStart = getMondayOfWeek(r.dataISO)
    weekMap.set(weekStart, (weekMap.get(weekStart) || 0) + (r.totalHours - STD_DAY_HOURS))
  }
  const sorted = [...weekMap.keys()].sort()
  const last5 = sorted.slice(-5)
  let cumulative = 0
  return last5.map((weekStart) => {
    cumulative += weekMap.get(weekStart)!
    if (!weekStart) return { label: "", value: Math.round(cumulative * 10) / 10 }
    const d = new Date(weekStart + "T12:00:00")
    const label = isNaN(d.getTime()) ? "" : `${d.getDate()}/${d.getMonth() + 1}`
    return { label, value: Math.round(cumulative * 10) / 10 }
  })
}

/**
 * Daily hours for the current week (Mon-Fri).
 * Replaces DashboardPage's inline `computeWeekDays`.
 */
export function computeWeekDays(records: TimeRecord[]): { day: string; hours: number }[] {
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex"]
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const start = monday.toISOString().split("T")[0]

  const hoursByDay = new Array(5).fill(0)
  for (const r of records) {
    if ((r.tipo === "Pendente" && r.entrada === "---") || !r.dataISO) continue
    const d = new Date(r.dataISO + "T12:00:00")
    if (isNaN(d.getTime())) continue
    if (r.dataISO < start) continue
    const dayIdx = d.getDay() - 1
    if (dayIdx >= 0 && dayIdx < 5) {
      hoursByDay[dayIdx] += r.totalHours
    }
  }
  const todayDayIdx = now.getDay() - 1
  return dayNames.map((dayName, i) => ({
    day: dayName,
    hours: i > todayDayIdx ? 0 : Math.round(hoursByDay[i] * 10) / 10,
  }))
}

/**
 * Projected end-of-month saldo based on last 7 days average.
 * Replaces BancoHorasPage's inline `projectedSaldo`.
 */
export function computeProjectedSaldo(
  dailySaldo: { cumulative: number }[],
  netSaldo: number,
): number {
  if (dailySaldo.length < 3) return netSaldo
  const last7 = dailySaldo.slice(-7)
  const avgDailyChange = last7.length >= 2
    ? (last7[last7.length - 1].cumulative - last7[0].cumulative) / last7.length
    : 0
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const remainingDays = Math.max(0, endOfMonth.getDate() - now.getDate())
  const workingDays = Math.max(0, remainingDays - Math.floor(remainingDays / 7) * 2)
  const proj = netSaldo + avgDailyChange * workingDays
  return isFinite(proj) ? proj : netSaldo
}

export interface AbsenceInfo {
  faltaISOs: string[]
  faltasCount: number
  justificadasCount: number
  naoJustificadasCount: number
}

/**
 * Compute absence info for a set of weekday ISOs.
 * Replaces Calendario's inline faltas logic.
 */
export function computeAbsences(
  allRecords: TimeRecord[],
  weekdayISOs: string[],
  justificacoes: Record<string, Justificacao>,
): AbsenceInfo {
  const faltaISOs = weekdayISOs.filter((iso) => {
    const j = justificacoes[iso]
    if (j && j.status === "aprovado") return false
    const rec = allRecords.find((r) => r.dataISO === iso && (r.tipo !== "Pendente" || r.entrada !== "---"))
    return !rec
  })
  return {
    faltaISOs,
    faltasCount: faltaISOs.length,
    justificadasCount: faltaISOs.filter((iso) => {
      const j = justificacoes[iso]
      return j && j.status === "em_analise"
    }).length,
    naoJustificadasCount: faltaISOs.filter((iso) => {
      const j = justificacoes[iso]
      return !j || j.status === "recusado"
    }).length,
  }
}
