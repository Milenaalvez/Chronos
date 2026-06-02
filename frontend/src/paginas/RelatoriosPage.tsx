import { useState, useMemo, useCallback, useEffect } from "react"
import {
  FileText, Download, ChevronDown, CheckCircle2, Loader2, X, AlertCircle,
} from "lucide-react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { TimeRecord, Justificacao, PageAction } from "../types"
import { PageHeader } from "../componentes/PageHeader"
import { formatMinutes, formatDataBR } from "../types"
import { computeSaldo, filterMonthRecords, computeFilteredTotals } from "../services/workHoursEngine"

interface RelatoriosPageProps {
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
  pageAction?: PageAction | null
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    const label = `${d.toLocaleDateString("pt-BR", { month: "long" })} de ${d.getFullYear()}`
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

const monthOptions = getMonthOptions()
const defaultMonth = monthOptions[0].value

const TIPO_OPTIONS = [
  "Resumo Mensal",
  "Banco de Horas",
  "Horas Extras",
  "Pendências",
  "Jornada Completa",
  "Ajustes e Correções",
] as const

function getStatusBadge(tipo: string, hasJustificacao: boolean, justStatus?: string) {
  if (tipo === "Pendente") {
    if (hasJustificacao) {
      if (justStatus === "aprovado") return { label: "Justificado", color: "text-[var(--accent-hover)]", bg: "bg-[var(--accent-hover)]/10" }
      if (justStatus === "recusado") return { label: "Recusado", color: "text-[#C96B6B]", bg: "bg-[#C96B6B]/10" }
      return { label: "Em análise", color: "text-[#C49A6B]", bg: "bg-[#C49A6B]/10" }
    }
    return { label: "Pendente", color: "text-[#C96B6B]", bg: "bg-[#C96B6B]/10" }
  }
  if (tipo === "Extra") return { label: "Extra", color: "text-[#C49A6B]", bg: "bg-[#C49A6B]/10" }
  if (tipo === "Compensação") return { label: "Comp.", color: "text-[var(--accent-hover)]", bg: "bg-[var(--accent-hover)]/10" }
  if (tipo === "Afastamento") return { label: "Negativo", color: "text-[#C96B6B]", bg: "bg-[#C96B6B]/10" }
  return { label: "Normal", color: "text-[#5B9B7A]", bg: "bg-[#5B9B7A]/10" }
}

interface TableRow {
  dataISO: string
  data: string
  entrada: string
  saida: string
  total: string
  totalHours: number
  tipo: string
  hasJustificacao: boolean
  justStatus?: string
  justMotivo?: string
}

function getExportSlug(monthLabel: string): string {
  return monthLabel.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

export function RelatoriosPage({ allRecords, justificacoes, pageAction }: RelatoriosPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [selectedTipo, setSelectedTipo] = useState<(typeof TIPO_OPTIONS)[number]>("Resumo Mensal")
  const [exporting, setExporting] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [modalState, setModalState] = useState<"select" | "reexport" | "exporting" | "success" | "error">("select")
  const [modalFormat, setModalFormat] = useState<string | null>(null)

  const [yearStr, monthStr] = selectedMonth.split("-")
  const year = Number(yearStr)
  const monthNum = Number(monthStr)
  const monthStart = `${year}-${pad(monthNum)}-01`
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const monthEnd = `${year}-${pad(monthNum)}-${pad(daysInMonth)}`
  const monthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label || selectedMonth

  const monthRecords = useMemo(() => {
    return filterMonthRecords(allRecords, { start: monthStart, end: monthEnd })
  }, [allRecords, monthStart, monthEnd])

  const monthTotals = useMemo(() => computeFilteredTotals(monthRecords), [monthRecords])
  const totalHours = monthTotals.totalMins / 60
  const totalExtraMins = monthTotals.extraMins
  const workedDays = monthTotals.workedDays
  const monthSaldoData = useMemo(() => computeSaldo(monthRecords, justificacoes), [monthRecords, justificacoes])
  const saldoMins = monthSaldoData.netSaldo

  const tableRows = useMemo(() => {
    const rows: TableRow[] = []

    for (const r of monthRecords) {
      const j = justificacoes[r.dataISO]
      rows.push({
        dataISO: r.dataISO,
        data: formatDataBR(r.dataISO),
        entrada: r.entrada,
        saida: r.saida,
        total: r.total,
        totalHours: r.totalHours,
        tipo: r.tipo,
        hasJustificacao: !!j,
        justStatus: j?.status,
        justMotivo: j?.motivo,
      })
    }

    rows.sort((a, b) => b.dataISO.localeCompare(a.dataISO))
    return rows
  }, [monthRecords, justificacoes])

  const filteredRows = useMemo(() => {
    if (selectedTipo === "Pendências") return tableRows.filter((r) => r.tipo === "Pendente")
    if (selectedTipo === "Horas Extras") return tableRows.filter((r) => r.tipo === "Extra")
    if (selectedTipo === "Jornada Completa") return tableRows
    if (selectedTipo === "Resumo Mensal") return tableRows
    if (selectedTipo === "Ajustes e Correções") return tableRows.filter((r) => r.hasJustificacao)
    return tableRows
  }, [tableRows, selectedTipo])

  const filteredTotals = useMemo(() => computeFilteredTotals(filteredRows as unknown as TimeRecord[]), [filteredRows])
  const totalHorasNoFiltro = filteredTotals.totalMins / 60
  const totalExtraNoFiltro = filteredTotals.extraMins
  const totalSaldoFiltro = filteredTotals.totalMins - filteredTotals.workedDays * 480
  const isFullView = selectedTipo === "Resumo Mensal" || selectedTipo === "Jornada Completa"
  const saldoNoFiltro = isFullView
    ? monthSaldoData.netSaldo
    : totalSaldoFiltro

  useEffect(() => {
    if (pageAction?.type === "openExport" && pageAction.payload) {
      const m = pageAction.payload.month
      const t = pageAction.payload.tipo
      if (m && monthOptions.some((o) => o.value === m)) setSelectedMonth(m)
      if (t && TIPO_OPTIONS.includes(t as any))     setSelectedTipo(t as (typeof TIPO_OPTIONS)[number])
      const storageKey = `chronos-exported-${m || selectedMonth}`
      if (localStorage.getItem(storageKey)) {
        setModalState("reexport")
      } else {
        setModalState("select")
      }
      setExportModalOpen(true)
    }
  }, [pageAction])

  const slug = getExportSlug(monthLabel)
  const filename = `chronos-relatorio-${slug}`

  const getExportData = useCallback(() => {
    return filteredRows.map((r) => ({
      Data: r.data,
      Entrada: r.entrada,
      Saída: r.saida,
      Total: r.total,
      Tipo: r.tipo === "Pendente" && r.hasJustificacao
        ? `Justificado${r.justMotivo ? ` (${r.justMotivo})` : ""}`
        : r.tipo,
    }))
  }, [filteredRows])

  async function exportCSV() {
    const data = getExportData()
    const headers = ["Data", "Entrada", "Saída", "Total", "Tipo"]
    const rows = data.map((r) => [r.Data, r.Entrada, r.Saída, r.Total, r.Tipo])
    const totalHoursStr = formatMinutes(Math.round(totalHorasNoFiltro * 60))
    const totalExtraStr = formatMinutes(totalExtraNoFiltro)
    const saldoStr = `${saldoNoFiltro >= 0 ? "+" : ""}${formatMinutes(Math.abs(saldoNoFiltro))}`
    rows.push([], ["Resumo", "", "", "", ""], [`Total: ${totalHoursStr}`, `Extras: ${totalExtraStr}`, `Saldo: ${saldoStr}`, `Registros: ${filteredRows.length}`, ""])

    let csv = "\uFEFF"
    csv += headers.join(";") + "\n"
    for (const row of rows) {
      csv += row.join(";") + "\n"
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportExcel() {
    const data = getExportData()
    const wb = XLSX.utils.book_new()

    const wsData = [
      ["Chronos - Banco de Horas"],
      [`Relatório: ${monthLabel}`],
      [`Tipo: ${selectedTipo}`],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
      [],
      ["Data", "Entrada", "Saída", "Total", "Tipo"],
      ...data.map((r) => [r.Data, r.Entrada, r.Saída, r.Total, r.Tipo]),
      [],
      ["Resumo do Período", "", "", "", ""],
      ["Total", formatMinutes(Math.round(totalHorasNoFiltro * 60)), "", "", ""],
      ["Extras", formatMinutes(totalExtraNoFiltro), "", "", ""],
      ["Saldo", `${saldoNoFiltro >= 0 ? "+" : ""}${formatMinutes(Math.abs(saldoNoFiltro))}`, "", "", ""],
      ["Registros", String(filteredRows.length), "", "", ""],
    ]

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, "Relatório")
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  async function exportPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" })

    doc.setFontSize(18)
    doc.setTextColor(98, 142, 203)
    doc.text("Chronos", 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text("Banco de Horas - Relatório", 14, 27)

    doc.setFontSize(14)
    doc.setTextColor(241, 245, 249)
    doc.text(`Resumo de ${monthLabel}`, 14, 37)

    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(`Tipo: ${selectedTipo}  |  Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 43)

    const summaryData = [
      ["Horas Trabalhadas", formatMinutes(Math.round(totalHours * 60))],
      ["Horas Extras", formatMinutes(totalExtraMins)],
      ["Saldo de Horas", `${saldoMins >= 0 ? "+" : ""}${formatMinutes(Math.abs(saldoMins))}`],
      ["Dias Trabalhados", String(workedDays)],
    ]
    autoTable(doc, {
      startY: 50,
      head: [["Métrica", "Valor"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [98, 142, 203], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { textColor: [241, 245, 249], fontSize: 8 },
      alternateRowStyles: { fillColor: [30, 41, 59] },
      styles: { cellPadding: 2.5 },
    })

    const tableData = filteredRows.map((r) => [
      r.data,
      r.entrada,
      r.saida,
      r.total,
      r.tipo === "Pendente" && r.hasJustificacao ? `Justificado${r.justMotivo ? ` (${r.justMotivo})` : ""}` : r.tipo,
    ])

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Data", "Entrada", "Saída", "Total", "Tipo"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [98, 142, 203], textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { textColor: [241, 245, 249], fontSize: 7 },
      alternateRowStyles: { fillColor: [30, 41, 59] },
      styles: { cellPadding: 2 },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 6
    doc.setFontSize(9)
    doc.setTextColor(241, 245, 249)
    doc.text("Resumo do Período", 14, finalY)

    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Total: ${formatMinutes(Math.round(totalHorasNoFiltro * 60))}`, 14, finalY + 6)
    doc.text(`Extras: ${formatMinutes(totalExtraNoFiltro)}`, 14, finalY + 11)
    doc.text(`Saldo: ${saldoNoFiltro >= 0 ? "+" : ""}${formatMinutes(Math.abs(saldoNoFiltro))}`, 14, finalY + 16)
    doc.text(`Registros: ${filteredRows.length}`, 14, finalY + 21)

    doc.save(`${filename}.pdf`)
  }

  async function handleExport(format: string) {
    setExporting(format)
    setSuccessMsg(null)
    if (exportModalOpen) setModalState("exporting")
    try {
      if (format === "csv") await exportCSV()
      else if (format === "xlsx") await exportExcel()
      else if (format === "pdf") await exportPDF()
      const storageKey = `chronos-exported-${selectedMonth}`
      localStorage.setItem(storageKey, new Date().toISOString())
      if (exportModalOpen) {
        setModalState("success")
      } else {
        setSuccessMsg(format)
      }
    } catch {
      if (exportModalOpen) {
        setModalState("error")
      } else {
        setSuccessMsg(`error_${format}`)
      }
    } finally {
      setExporting(null)
      if (!exportModalOpen) setTimeout(() => setSuccessMsg(null), 3000)
    }
  }

  function closeExportModal() {
    setExportModalOpen(false)
    setModalState("select")
    setModalFormat(null)
  }

  function handleModalExport(format: string) {
    setModalFormat(format)
    handleExport(format)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Relatórios"
        subtitle="Acompanhe e exporte seus relatórios de horas."
      />

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none w-full sm:w-auto sm:min-w-[10rem] h-11 px-3 pr-7 rounded-lg border border-default/20 bg-input text-sm text-primary outline-none focus:border-[var(--accent-hover)]/50 transition-all duration-200 cursor-pointer"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>

        <div className="relative w-full sm:w-auto">
          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value as (typeof TIPO_OPTIONS)[number])}
            className="appearance-none w-full sm:w-auto sm:min-w-[10rem] h-11 px-3 pr-7 rounded-lg border border-default/20 bg-input text-sm text-primary outline-none focus:border-[var(--accent-hover)]/50 transition-all duration-200 cursor-pointer"
          >
            {TIPO_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => handleExport("pdf")}
              disabled={filteredRows.length === 0 || exporting !== null}
              className="flex items-center gap-2 h-11 px-4 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.5} />}
              {exporting === "pdf" ? "Gerando PDF..." : "PDF"}
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              disabled={filteredRows.length === 0 || exporting !== null}
              className="flex items-center gap-2 h-11 px-4 rounded-lg border border-default/20 text-sm font-semibold text-primary hover:bg-elevated/20 dark:hover:bg-white/[0.02] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting === "xlsx" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.5} />}
              {exporting === "xlsx" ? "Gerando Excel..." : "Excel"}
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={filteredRows.length === 0 || exporting !== null}
              className="flex items-center gap-2 h-11 px-4 rounded-lg border border-default/20 text-sm font-semibold text-primary hover:bg-elevated/20 dark:hover:bg-white/[0.02] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting === "csv" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.5} />}
              {exporting === "csv" ? "Gerando CSV..." : "CSV"}
            </button>
          </div>
      </div>

      {successMsg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
          successMsg.startsWith("error")
            ? "bg-[#C96B6B]/8 text-[#C96B6B]"
            : "bg-[#5B9B7A]/8 text-[#5B9B7A]"
        }`}>
          <CheckCircle2 size={13} strokeWidth={2.5} />
          {successMsg.startsWith("error")
            ? "Não foi possível gerar o relatório. Tente novamente."
            : `Relatório exportado com sucesso (${successMsg.toUpperCase()}).`}
        </div>
      )}

      <div className="bg-elevated/50 h-px" />

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-[var(--accent-hover)]" />
          <h2 className="text-sm font-bold text-primary">Resumo de {monthLabel}</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Horas Trabalhadas</span>
            <span className="text-lg font-bold text-primary font-mono tracking-tight">{formatMinutes(Math.round(totalHours * 60))}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Horas Extras</span>
            <span className="text-lg font-bold text-[#C49A6B] font-mono tracking-tight">{formatMinutes(totalExtraMins)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Saldo de Horas</span>
            <span className={`text-lg font-bold font-mono tracking-tight ${saldoMins >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
              {saldoMins >= 0 ? "+" : ""}{formatMinutes(Math.abs(saldoMins))}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Dias Trabalhados</span>
            <span className="text-lg font-bold text-primary font-mono tracking-tight">{workedDays}</span>
          </div>
        </div>

        <div className="bg-elevated/50 h-px" />

        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[600px] lg:min-w-0">
            <thead>
              <tr className="border-b border-default">
                <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-2 sm:pr-4">Data</th>
                <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-2 sm:pr-4">Entrada</th>
                <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-2 sm:pr-4">Saída</th>
                <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-2 sm:pr-4">Total</th>
                <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-2 sm:pr-4">Tipo</th>
                <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pt-10 pb-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={18} className="text-[var(--accent-hover)]" />
                      <p className="text-xs text-muted">Nenhum registro encontrado para este período.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const badge = getStatusBadge(row.tipo, row.hasJustificacao, row.justStatus)
                  return (
                    <tr
                      key={row.dataISO + (row.tipo === "Pendente" ? "_pend" : "")}
                      className="transition-all duration-200 hover:bg-elevated/20 group border-b border-default last:border-b-0"
                    >
                      <td className="py-3 pr-2 sm:pr-4">
                        <span className="text-sm font-medium text-primary font-mono">{row.data}</span>
                      </td>
                      <td className="py-3 pr-2 sm:pr-4">
                        <span className={`text-sm font-mono ${row.entrada === "---" ? "text-[var(--accent-hover)]" : "text-secondary"}`}>
                          {row.entrada}
                        </span>
                      </td>
                      <td className="py-3 pr-2 sm:pr-4">
                        <span className={`text-sm font-mono ${row.saida === "---" ? "text-[var(--accent-hover)]" : "text-secondary"}`}>
                          {row.saida}
                        </span>
                      </td>
                      <td className="py-3 pr-2 sm:pr-4">
                        <span className={`text-sm font-semibold font-mono ${row.total === "---" ? "text-[var(--accent-hover)]" : "text-primary"}`}>
                          {row.total}
                        </span>
                      </td>
                      <td className="py-3 pr-2 sm:pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3">
                        {row.hasJustificacao && row.justMotivo ? (
                            <span className="text-xs text-muted whitespace-normal break-words max-w-[140px] sm:max-w-[220px] inline-block leading-relaxed">
                            {row.justMotivo}
                          </span>
                        ) : row.tipo === "Pendente" ? (
                          <span className="text-xs text-[#C96B6B]">Pendente</span>
                        ) : (
                          <span className="text-xs text-[#5B9B7A]">OK</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-elevated/50 h-px" />

        {filteredRows.length > 0 && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-8 pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Total no período</span>
              <span className="text-sm font-bold text-primary font-mono">{formatMinutes(Math.round(totalHorasNoFiltro * 60))}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Extras</span>
              <span className="text-sm font-bold text-[#C49A6B] font-mono">{formatMinutes(totalExtraNoFiltro)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Saldo</span>
              <span className={`text-sm font-bold font-mono ${saldoNoFiltro >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
                {saldoNoFiltro >= 0 ? "+" : ""}{formatMinutes(Math.abs(saldoNoFiltro))}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Registros</span>
              <span className="text-sm font-bold text-primary font-mono">{filteredRows.length}</span>
            </div>
          </div>
        )}
      </div>

      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeExportModal} />
          <div className="relative w-full max-w-md mx-4 bg-surface rounded-xl animate-in fade-in zoom-in duration-200 dark:border dark:border-white/6">
            <button
              onClick={closeExportModal}
              className="absolute top-4 right-4 w-11 h-11 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div className="px-6 py-5">
              <div className="flex flex-col gap-1 mb-5">
                <h2 className="text-lg font-bold text-primary tracking-tight">Exportar Relatório</h2>
                <p className="text-sm text-secondary">{monthLabel} · {selectedTipo}</p>
              </div>

              {modalState === "reexport" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3 rounded-lg bg-[#C49A6B]/8 px-4 py-3">
                    <AlertCircle size={15} className="text-[#C49A6B] shrink-0 mt-0.5" />
                    <p className="text-xs text-secondary leading-relaxed">
                      Você já exportou este relatório anteriormente. Deseja exportar novamente?
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setModalState("select") }}
                      className="flex-1 h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                    >
                      Exportar novamente
                    </button>
                    <button
                      onClick={closeExportModal}
                      className="flex-1 h-11 rounded-lg bg-surface border border-default/40 dark:border-white/6 text-sm font-medium text-secondary hover:text-primary transition-all duration-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {modalState === "select" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg bg-elevated/30 px-4 py-3 flex flex-col gap-2 dark:bg-transparent dark:border dark:border-white/6">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Período</span>
                      <span className="text-xs font-semibold text-primary">{monthLabel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Registros</span>
                      <span className="text-xs font-semibold text-primary font-mono">{filteredRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Horas trabalhadas</span>
                      <span className="text-xs font-semibold text-primary font-mono">{formatMinutes(Math.round(totalHours * 60))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Saldo</span>
                      <span className={`text-xs font-semibold font-mono ${saldoMins >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
                        {saldoMins >= 0 ? "+" : ""}{formatMinutes(Math.abs(saldoMins))}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleModalExport("pdf")}
                      disabled={exporting !== null}
                      className="flex items-center gap-3 w-full h-11 px-4 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {exporting && modalFormat === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                      {exporting && modalFormat === "pdf" ? "Gerando PDF..." : "Exportar PDF"}
                    </button>
                    <button
                      onClick={() => handleModalExport("xlsx")}
                      disabled={exporting !== null}
                      className="flex items-center gap-3 w-full h-11 px-4 rounded-lg bg-surface border border-default/40 dark:border-white/6 text-sm font-semibold text-secondary hover:text-primary hover:bg-elevated transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {exporting && modalFormat === "xlsx" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      {exporting && modalFormat === "xlsx" ? "Gerando Excel..." : "Exportar Excel (.xlsx)"}
                    </button>
                    <button
                      onClick={() => handleModalExport("csv")}
                      disabled={exporting !== null}
                      className="flex items-center gap-3 w-full h-11 px-4 rounded-lg bg-surface border border-default/40 dark:border-white/6 text-sm font-semibold text-secondary hover:text-primary hover:bg-elevated transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {exporting && modalFormat === "csv" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      {exporting && modalFormat === "csv" ? "Gerando CSV..." : "Exportar CSV"}
                    </button>
                  </div>

                  <button
                    onClick={closeExportModal}
                    className="text-xs font-medium text-muted hover:text-primary transition-colors self-center"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {modalState === "exporting" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 size={24} className="animate-spin text-[var(--accent-hover)]" />
                  <p className="text-sm text-secondary">Gerando relatório...</p>
                </div>
              )}

              {modalState === "success" && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-11 h-11 rounded-lg bg-[#5B9B7A]/8 flex items-center justify-center">
                    <CheckCircle2 size={20} className="text-[#5B9B7A]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-primary">Relatório exportado com sucesso</p>
                    <p className="text-xs text-muted mt-1">O download foi iniciado automaticamente.</p>
                  </div>
                  <button
                    onClick={closeExportModal}
                    className="h-11 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {modalState === "error" && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-11 h-11 rounded-lg bg-[#C96B6B]/8 flex items-center justify-center">
                    <AlertCircle size={20} className="text-[#C96B6B]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-primary">Não foi possível exportar</p>
                    <p className="text-xs text-muted mt-1">Tente novamente ou escolha outro formato.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setModalState("select"); setModalFormat(null) }}
                      className="h-11 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                    >
                      Tentar novamente
                    </button>
                    <button
                      onClick={closeExportModal}
                      className="h-11 px-5 rounded-lg bg-surface border border-default/40 dark:border-white/6 text-sm font-medium text-secondary hover:text-primary transition-all duration-200"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
