import type { TimeRecord, Justificacao } from "../types"
import { formatMinutes } from "../types"

const STD_DAY_HOURS = 8
const STD_DAY_MINS = STD_DAY_HOURS * 60

export { formatMinutes }

export function getMonthBounds(iso?: string) {
  if (iso) {
    const [y, m] = iso.split("-").map(Number)
    const start = `${y}-${String(m).padStart(2, "0")}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    return { start, end }
  }
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

export function currentMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number)
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ]
  return `${months[m - 1]} de ${y}`
}

export function isWeekday(iso: string): boolean {
  const d = new Date(iso + "T12:00:00")
  const day = d.getDay()
  return day !== 0 && day !== 6
}

export function getMondayOfWeek(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T12:00:00")
  if (isNaN(d.getTime())) return ""
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return monday.toISOString().split("T")[0]
}

export function filterMonthRecords(records: TimeRecord[], bounds?: { start: string; end: string }) {
  const b = bounds ?? getMonthBounds()
  return records.filter((r) => {
    if (r.dataISO < b.start || r.dataISO > b.end) return false
    if (!isWeekday(r.dataISO)) return false
    return true
  })
}

export function filterMonthRecordsStrict(records: TimeRecord[], bounds?: { start: string; end: string }) {
  return filterMonthRecords(records, bounds).filter((r) => r.tipo !== "Pendente")
}

export interface SaldoResult {
  positiveMins: number
  negativeMins: number
  netSaldo: number
  totalWorkedMins: number
  extraMins: number
  totalAbsences: number
  justifiedAbsences: number
  dailySaldo: { iso: string; label: string; saldo: number; cumulative: number }[]
}

export function computeSaldo(records: TimeRecord[], justificacoes: Record<string, Justificacao>): SaldoResult {
  let positiveMins = 0
  let negativeMins = 0
  let totalWorkedMins = 0
  let extraMins = 0
  let totalAbsences = 0
  let justifiedAbsences = 0

  const dailyList: { iso: string; label: string; saldo: number }[] = []
  const dayIndex = new Map<string, number>()

  for (const r of records) {
    if (r.tipo === "Pendente") {
      if (r.entrada !== "---") {
        const mins = Math.round(r.totalHours * 60)
        totalWorkedMins += mins
        const saldo = mins - STD_DAY_MINS
        if (saldo > 0) positiveMins += saldo
        else if (saldo < 0) negativeMins += Math.abs(saldo)
        const idx = dayIndex.size
        dayIndex.set(r.dataISO, idx)
        dailyList.push({
          iso: r.dataISO,
          label: r.dataISO.slice(8, 10) + "/" + r.dataISO.slice(5, 7),
          saldo,
        })
        continue
      }
      const j = justificacoes[r.dataISO]
      if (j) {
        if (j.status === "aprovado") {
          totalAbsences++
          justifiedAbsences++
        } else if (j.status === "recusado") {
          totalAbsences++
          negativeMins += STD_DAY_MINS
        } else {
          totalAbsences++
        }
      } else {
        totalAbsences++
        negativeMins += STD_DAY_MINS
      }
      continue
    }

    const j = justificacoes[r.dataISO]
    if (j && j.status === "aprovado") {
      justifiedAbsences++
      const mins = Math.round(r.totalHours * 60)
      totalWorkedMins += mins
      const idx = dayIndex.size
      dayIndex.set(r.dataISO, idx)
      dailyList.push({
        iso: r.dataISO,
        label: r.dataISO.slice(8, 10) + "/" + r.dataISO.slice(5, 7),
        saldo: 0,
      })
      continue
    }

    const mins = Math.round(r.totalHours * 60)
    totalWorkedMins += mins
    const saldo = mins - STD_DAY_MINS

    if (saldo > 0) {
      positiveMins += saldo
      extraMins += saldo
    } else if (saldo < 0) {
      negativeMins += Math.abs(saldo)
    }

    const idx = dayIndex.size
    dayIndex.set(r.dataISO, idx)
    dailyList.push({
      iso: r.dataISO,
      label: r.dataISO.slice(8, 10) + "/" + r.dataISO.slice(5, 7),
      saldo,
    })
  }

  dailyList.sort((a, b) => a.iso.localeCompare(b.iso))

  let acc = 0
  const cumulative = dailyList.map((d) => {
    acc += d.saldo
    return { ...d, cumulative: acc }
  })

  const netSaldo = positiveMins - negativeMins

  return {
    positiveMins,
    negativeMins,
    netSaldo,
    totalWorkedMins,
    extraMins,
    totalAbsences,
    justifiedAbsences,
    dailySaldo: cumulative,
  }
}

export interface SimpleMonthStats {
  totalMins: number
  extraMins: number
  workedDays: number
  normalHours: number
  totalNormalExtraMins: number
}

export function computeMonthStats(records: TimeRecord[]): SimpleMonthStats {
  const totalMins = records.reduce((s, r) => s + r.totalHours * 60, 0)
  const extraMins = records.reduce((s, r) => s + Math.max((r.totalHours - STD_DAY_HOURS) * 60, 0), 0)
  const workedDays = new Set(records.filter((r) => !(r.tipo === "Pendente" && r.entrada === "---")).map((r) => r.dataISO)).size
  const normalHours = records
    .filter((r) => r.tipo === "Normal" || r.tipo === "Compensação")
    .reduce((s, r) => s + r.totalHours, 0)
  const totalNormalExtraMins = records
    .filter((r) => r.tipo !== "Pendente" && r.tipo !== "Afastamento")
    .reduce((s, r) => s + r.totalHours * 60, 0)
  return { totalMins, extraMins, workedDays, normalHours, totalNormalExtraMins }
}
