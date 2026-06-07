import { useState, useEffect, useMemo, useCallback } from "react"
import {
  FileText, Download, Loader2, X, ChevronRight, Search,
  Clock, TrendingUp, Users, UserX, Calendar,
  Lock, Unlock, ShieldCheck, AlertTriangle, Eye,
  BarChart3, Building2, UserCheck, SlidersHorizontal, Activity,
} from "lucide-react"
import { reports as apiReports, reference as apiRef } from "../services/api"
import { PageHeader } from "../componentes/PageHeader"
import { JustificativasPage } from "./JustificativasPage"
import { EmAnalisePage } from "./EmAnalisePage"
import { AuditoriaPage } from "./AuditoriaPage"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface ConsolidatedRow {
  userId: string
  colaborador: string
  email: string
  departamento: string
  cargo: string
  contrato: string
  horasTrabalhadas: number
  horasExtras: number
  saldoBanco: number
  faltas: number
  atrasos: number
  diasTrabalhados: number
  diasUteis: number
  justificativasPendentes: number
  justificativasAprovadas: number
  status: "ok" | "alerta" | "pendente" | "incompleto"
  registros: { data: string; entrada: string | null; saida: string | null; totalMinutos: number | null; extraMinutos: number; status: string; reviewStatus: string | null }[]
  justificativas: { motivo: string; status: string; inicio: string; fim: string }[]
}

interface ReportData {
  rows: ConsolidatedRow[]
  indicadores: {
    horasTrabalhadas: number
    horasExtras: number
    saldoBanco: number
    colaboradoresComRegistros: number
    ausencias: number
    atrasos: number
    diasUteis: number
    totalColaboradores: number
  }
  fechamento: { status: string; closedAt: string | null; closedBy: string | null }
}

function pad(n: number): string { return String(n).padStart(2, "0") }

function fmtMins(m: number): string {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return `${h}h${pad(r)}m`
}

function fmtDate(iso: string): string {
  if (!iso) return "---"
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR")
}

function fmtDateTime(iso: string): string {
  if (!iso) return "---"
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  ok: { label: "OK", color: "text-accent-green", bg: "bg-accent-green/10" },
  alerta: { label: "Alerta", color: "text-accent-amber", bg: "bg-accent-amber/10" },
  pendente: { label: "Pendente", color: "text-accent-purple", bg: "bg-accent-purple/10" },
  incompleto: { label: "Incompleto", color: "text-accent-red", bg: "bg-accent-red/10" },
}

function getMonthOptions() {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    const label = `${d.toLocaleDateString("pt-BR", { month: "long" })} de ${d.getFullYear()}`
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

const monthOptions = getMonthOptions()
const defaultMonth = monthOptions[0].value

const ITEMS_PER_PAGE = 20

interface RelatoriosPageProps {
  user?: {
    id: string
    role: string
    name: string
  } | null
}

const TABS = [
  { key: "consolidado", label: "Consolidado", icon: BarChart3 },
  { key: "justificativas", label: "Justificativas", icon: FileText },
  { key: "em-analise", label: "Em Análise", icon: ShieldCheck },
  { key: "auditoria", label: "Auditoria", icon: Activity },
] as const

type RelTabKey = (typeof TABS)[number]["key"]

export function RelatoriosPage({ user }: RelatoriosPageProps) {
  const [tab, setTab] = useState<RelTabKey>("consolidado")
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [departmentId, setDepartmentId] = useState("")
  const [positionId, setPositionId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [collaboratorSearch, setCollaboratorSearch] = useState("")

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])

  const [drawerUser, setDrawerUser] = useState<ConsolidatedRow | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [closingLoading, setClosingLoading] = useState(false)
  const [closingMsg, setClosingMsg] = useState<string | null>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const hasActiveFilters = departmentId || positionId || statusFilter || collaboratorSearch

  function clearFilters() {
    setDepartmentId("")
    setPositionId("")
    setStatusFilter("")
    setCollaboratorSearch("")
  }

  const [yearStr, monthStr] = selectedMonth.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const monthLabel = monthOptions.find(o => o.value === selectedMonth)?.label || selectedMonth

  const ind = data?.indicadores
  const semRegistro = ind ? ind.totalColaboradores - ind.colaboradoresComRegistros : 0
  const pendencias = ind ? ind.ausencias + ind.atrasos : 0

  useEffect(() => {
    apiRef.departments().then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    if (departmentId) {
      apiRef.positions(departmentId).then(setPositions).catch(() => setPositions([]))
    } else {
      setPositions([])
    }
    setPositionId("")
  }, [departmentId])

  useEffect(() => { setPage(1) }, [selectedMonth, departmentId, positionId, statusFilter, collaboratorSearch])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiReports.consolidated({ year, month, departmentId: departmentId || undefined, positionId: positionId || undefined, status: statusFilter || undefined })
      setData(result)
    } catch { setData(null) } finally { setLoading(false) }
  }, [year, month, departmentId, positionId, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const userRole = user?.role || ""

  const rows = data?.rows || []
  const filtered = useMemo(() => {
    let list = rows
    if (collaboratorSearch) {
      const q = collaboratorSearch.toLowerCase()
      list = list.filter(r => r.colaborador.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    }
    return list
  }, [rows, collaboratorSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  function handleCloseMonth() {
    if (!confirm(`Fechar competência de ${monthLabel}? Após fechar, alterações serão bloqueadas.`)) return
    setClosingLoading(true)
    setClosingMsg(null)
    apiReports.closeMonth(year, month)
      .then(() => {
        setClosingMsg("Competência fechada com sucesso!")
        fetchData()
        apiReports.auditLog(year, month).then(setAuditLog).catch(() => {})
      })
      .catch((err: any) => setClosingMsg(err.message || "Erro ao fechar"))
      .finally(() => setClosingLoading(false))
  }

  function handleReopenMonth() {
    if (!confirm(`Reabrir competência de ${monthLabel}? Esta ação será registrada em auditoria.`)) return
    setClosingLoading(true)
    setClosingMsg(null)
    apiReports.reopenMonth(year, month)
      .then(() => {
        setClosingMsg("Competência reaberta com sucesso!")
        fetchData()
        apiReports.auditLog(year, month).then(setAuditLog).catch(() => {})
      })
      .catch((err: any) => setClosingMsg(err.message || "Erro ao reabrir"))
      .finally(() => setClosingLoading(false))
  }

  useEffect(() => {
    if (data?.fechamento?.status === "closed") {
      apiReports.auditLog(year, month).then(setAuditLog).catch(() => {})
    }
  }, [data?.fechamento?.status, year, month])

  async function exportPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59)
    doc.text("Relatório Corporativo", 14, 20)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`${monthLabel} · ${filtered.length} colaboradores`, 14, 27)

    const body = filtered.map(r => [
      r.colaborador, r.departamento,
      fmtMins(r.horasTrabalhadas), fmtMins(r.horasExtras),
      `${r.saldoBanco >= 0 ? "+" : ""}${fmtMins(Math.abs(r.saldoBanco))}`,
      String(r.faltas), String(r.atrasos),
      STATUS_LABEL[r.status]?.label || r.status,
    ])
    autoTable(doc, {
      startY: 33,
      head: [["Colaborador", "Departamento", "Horas Trab.", "Extras", "Saldo", "Faltas", "Atrasos", "Status"]],
      body,
      theme: "grid",
      headStyles: { fillColor: [98, 142, 203], textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 1.5 },
    })
    doc.save(`relatorio-corporativo-${year}-${pad(month)}.pdf`)
  }

  async function exportExcel() {
    const wb = XLSX.utils.book_new()
    const header = ["Colaborador", "Departamento", "Cargo", "Horas Trabalhadas", "Horas Extras", "Saldo Banco", "Faltas", "Atrasos", "Status"]
    const body = filtered.map(r => [
      r.colaborador, r.departamento, r.cargo,
      fmtMins(r.horasTrabalhadas), fmtMins(r.horasExtras),
      `${r.saldoBanco >= 0 ? "+" : ""}${fmtMins(Math.abs(r.saldoBanco))}`,
      r.faltas, r.atrasos, STATUS_LABEL[r.status]?.label || r.status,
    ])
    const wsData = [
      [`Relatório Corporativo - ${monthLabel}`],
      [],
      header,
      ...body,
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, "Relatório")
    XLSX.writeFile(wb, `relatorio-corporativo-${year}-${pad(month)}.xlsx`)
  }

  async function handleExport(format: string) {
    setExporting(format)
    try {
      if (format === "pdf") await exportPDF()
      else if (format === "xlsx") await exportExcel()
    } catch { /* ignore */ } finally { setExporting(null) }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        subtitle="Acompanhamento geral da empresa, justificativas, análise e auditoria."
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-default/30 overflow-x-auto flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 ${
                isActive
                  ? "border-[var(--accent-primary)] text-primary"
                  : "border-transparent text-muted hover:text-secondary hover:border-default/30"
              }`}
            >
              <Icon size={13} strokeWidth={2} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab !== "consolidado" && (
        <>
          {tab === "justificativas" && <JustificativasPage />}
          {tab === "em-analise" && <EmAnalisePage />}
          {tab === "auditoria" && <AuditoriaPage />}
        </>
      )}

      {tab === "consolidado" && (<>
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="appearance-none h-9 pl-3 pr-7 rounded-lg border border-default bg-input text-xs text-primary outline-none focus:border-[var(--accent-ring)]"
          >
            {monthOptions.map(o => <option key={o.value} value={o.value} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{o.label}</option>)}
          </select>
          <ChevronRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none rotate-90" />
        </div>
        <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
          className="h-9 px-2.5 rounded-lg border border-default bg-input text-xs text-primary outline-none focus:border-[var(--accent-ring)]"
        >
          <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Todos os Departamentos</option>
          {departments.map((d: any) => <option key={d.id} value={d.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{d.name}</option>)}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" strokeWidth={2} />
          <input value={collaboratorSearch} onChange={e => setCollaboratorSearch(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-default bg-input text-xs text-primary placeholder:text-muted outline-none focus:border-[var(--accent-ring)]"
          />
        </div>
        <button onClick={() => setShowAdvancedFilters(true)}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-medium transition-all ${positionId || statusFilter ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/8" : "border-default text-muted hover:text-primary hover:bg-elevated/20"}`}
        >
          <SlidersHorizontal size={13} />
          Filtros Avançados
          {(positionId || statusFilter) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />}
        </button>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => handleExport("pdf")} disabled={!rows.length || !!exporting}
            className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--accent-primary)] text-[10px] font-bold text-white shadow-[0_3px_8px_-4px_var(--accent-primary)] hover:brightness-110 active:scale-[0.96] transition-all duration-150 disabled:opacity-40"
          >
            {exporting === "pdf" ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
            PDF
          </button>
          <button onClick={() => handleExport("xlsx")} disabled={!rows.length || !!exporting}
            className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--accent-primary)] text-[10px] font-bold text-white shadow-[0_3px_8px_-4px_var(--accent-primary)] hover:brightness-110 active:scale-[0.96] transition-all duration-150 disabled:opacity-40"
          >
            {exporting === "xlsx" ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
            Excel
          </button>
        </div>
      </div>

      {/* Metric cards — always visible */}
      <div className="flex flex-wrap items-stretch overflow-hidden rounded-xl bg-app border border-default">
        {[
          { label: "Horas Trabalhadas", value: data ? fmtMins(data.indicadores.horasTrabalhadas) : "---", sub: "Total do período", icon: Clock, color: "text-accent-purple/80", bg: "bg-accent-purple/5" },
          { label: "Horas Extras", value: data ? fmtMins(data.indicadores.horasExtras) : "---", sub: "Acima da jornada", icon: TrendingUp, color: "text-accent-amber/80", bg: "bg-accent-amber/5" },
          { label: "Saldo Banco", value: data ? `${data.indicadores.saldoBanco >= 0 ? "+" : ""}${fmtMins(Math.abs(data.indicadores.saldoBanco))}` : "---", sub: "Horas acumuladas", icon: BarChart3, color: data && data.indicadores.saldoBanco >= 0 ? "text-accent-green/80" : "text-accent-red/80", bg: data && data.indicadores.saldoBanco >= 0 ? "bg-accent-green/5" : "bg-accent-red/5" },
          { label: "C/ Registros", value: data ? String(data.indicadores.colaboradoresComRegistros) : "---", sub: data ? `de ${data.indicadores.totalColaboradores} colaboradores` : "Aguardando dados", icon: UserCheck, color: "text-accent-green/80", bg: "bg-accent-green/5" },
          { label: "Ausências", value: data ? String(data.indicadores.ausencias) : "---", sub: "Faltas no período", icon: UserX, color: "text-accent-red/80", bg: "bg-accent-red/5" },
          { label: "Dias Úteis", value: data ? String(data.indicadores.diasUteis) : "---", sub: "Dias letivos", icon: Calendar, color: "text-accent-blue/80", bg: "bg-accent-blue/5" },
        ].map((c, i) => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`w-1/2 lg:w-1/3 xl:w-1/6 flex flex-col gap-2 p-5 ${i < 5 ? "border-r border-default" : ""} ${c.bg}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <Icon size={15} className={c.color} />
                </div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{c.label}</span>
              </div>
              <span className="text-xl font-bold text-primary font-mono tracking-tight">{c.value}</span>
              <span className="text-[10px] text-muted">{c.sub}</span>
            </div>
          )
        })}
      </div>

      {/* Status da Competência + Resumo Operacional — always visible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status da Competência */}
        <div className="rounded-xl bg-app border border-default p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                data?.fechamento?.status === "closed" ? "bg-accent-amber/10" : "bg-accent-green/10"
              }`}>
                {data?.fechamento?.status === "closed"
                  ? <Lock size={18} className="text-accent-amber" />
                  : <Unlock size={18} className="text-accent-green" />
                }
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Competência</p>
                <p className="text-sm font-bold text-primary mt-0.5">{monthLabel}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2 h-2 rounded-full ${data?.fechamento?.status === "closed" ? "bg-accent-amber" : "bg-accent-green"}`} />
                  <span className={`text-[11px] font-semibold ${data?.fechamento?.status === "closed" ? "text-accent-amber" : "text-accent-green"}`}>
                    {data?.fechamento?.status === "closed" ? "Fechada" : "Aberta"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 mt-2">
                  {data?.fechamento?.status === "closed" && data.fechamento.closedAt && (
                    <p className="text-[11px] text-muted">
                      Fechada em {fmtDateTime(data.fechamento.closedAt)}
                    </p>
                  )}
                  {data?.fechamento?.status === "closed" && data.fechamento.closedBy && (
                    <p className="text-[11px] text-muted">
                      Responsável: <span className="text-primary font-medium">{data.fechamento.closedBy}</span>
                    </p>
                  )}
                  {data?.fechamento?.status !== "closed" && (
                    <p className="text-[11px] text-muted">Registros podem ser editados normalmente.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {data?.fechamento?.status === "closed" ? (
                userRole === "DEVELOPER" && (
                  <button onClick={handleReopenMonth} disabled={closingLoading}
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-accent-amber/30 text-[11px] font-semibold text-accent-amber hover:bg-accent-amber/8 transition-all disabled:opacity-40"
                  >
                    {closingLoading ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                    Reabrir
                  </button>
                )
              ) : (
                ["RH", "ADMIN", "DEVELOPER"].includes(userRole) && (
                  <button onClick={handleCloseMonth} disabled={closingLoading}
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] text-[11px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-all disabled:opacity-40"
                  >
                    {closingLoading ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                    Fechar Competência
                  </button>
                )
              )}
            </div>
          </div>
          {/* Audit log inline */}
          {auditLog.length > 0 && data?.fechamento?.status === "closed" && (
            <details className="group mt-4 pt-3 border-t border-default">
              <summary className="flex items-center gap-2 cursor-pointer text-[10px] font-medium text-muted hover:text-primary transition-all">
                <ChevronRight size={11} className="group-open:rotate-90 transition-transform" />
                Histórico ({auditLog.length})
              </summary>
              <div className="flex flex-col mt-2 gap-1">
                {auditLog.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg text-[10px]">
                    {log.action === "CLOSE_MONTH" ? <Lock size={10} className="text-accent-amber" /> : <Unlock size={10} className="text-accent-green" />}
                    <span className="text-primary font-medium">{log.user}</span>
                    <span className="text-muted">{log.action === "CLOSE_MONTH" ? "fechou" : "reabriu"}</span>
                    <span className="text-muted ml-auto">{fmtDateTime(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Resumo Operacional */}
        <div className="rounded-xl bg-app border border-default p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={14} className="text-muted" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Resumo Operacional</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Total Colaboradores", value: data ? String(ind!.totalColaboradores) : "---", icon: Users, color: "text-accent-purple", bg: "bg-accent-purple/10" },
              { label: "Com Registro", value: data ? String(ind!.colaboradoresComRegistros) : "---", icon: UserCheck, color: "text-accent-green", bg: "bg-accent-green/10" },
              { label: "Sem Registro", value: data ? String(semRegistro) : "---", icon: UserX, color: data && semRegistro > 0 ? "text-accent-red" : "text-muted", bg: data && semRegistro > 0 ? "bg-accent-red/10" : "bg-elevated/20" },
              { label: "Pendências", value: data ? String(pendencias) : "---", icon: AlertTriangle, color: data && pendencias > 0 ? "text-accent-amber" : "text-muted", bg: data && pendencias > 0 ? "bg-accent-amber/10" : "bg-elevated/20" },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-elevated/20">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                    <Icon size={15} className={item.color} />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-primary">{item.value}</span>
                    <p className="text-[9px] text-muted font-medium uppercase tracking-wider">{item.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {closingMsg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${closingMsg.includes("sucesso") ? "bg-accent-green/10 text-accent-green" : "bg-accent-red/10 text-accent-red"}`}>
          {closingMsg.includes("sucesso") ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {closingMsg}
        </div>
      )}

      {/* Collaborator count */}
      <div className="flex items-center justify-end">
        <span className="text-[11px] text-muted">{filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 rounded-lg bg-elevated/20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-default">
                <th className="text-left text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Colaborador</th>
                <th className="text-left text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Departamento</th>
                <th className="text-right text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Horas</th>
                <th className="text-right text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Extras</th>
                <th className="text-right text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Saldo</th>
                <th className="text-center text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Faltas</th>
                <th className="text-center text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Atrasos</th>
                <th className="text-left text-[10px] text-muted font-semibold uppercase tracking-wider pb-3 pr-3">Status</th>
                <th className="text-right text-[10px] text-muted font-semibold uppercase tracking-wider pb-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => {
                const st = STATUS_LABEL[r.status]
                return (
                  <tr key={r.userId} className="group border-b border-default last:border-b-0 hover:bg-elevated/10 transition-all">
                    <td className="py-3 pr-3">
                      <span className="text-xs font-semibold text-primary">{r.colaborador}</span>
                      <p className="text-[10px] text-muted">{r.cargo}</p>
                    </td>
                    <td className="py-3 pr-3 text-xs text-secondary">{r.departamento}</td>
                    <td className="py-3 pr-3 text-xs font-mono text-primary text-right font-medium">{fmtMins(r.horasTrabalhadas)}</td>
                    <td className="py-3 pr-3 text-xs font-mono text-right">
                      <span className={r.horasExtras > 0 ? "text-accent-amber font-medium" : "text-muted"}>{fmtMins(r.horasExtras)}</span>
                    </td>
                    <td className="py-3 pr-3 text-xs font-mono text-right font-medium">
                      <span className={r.saldoBanco >= 0 ? "text-accent-green" : "text-accent-red"}>
                        {r.saldoBanco >= 0 ? "+" : ""}{fmtMins(Math.abs(r.saldoBanco))}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs text-center">
                      <span className={r.faltas > 0 ? "text-accent-red font-medium" : "text-muted"}>{r.faltas}</span>
                    </td>
                    <td className="py-3 pr-3 text-xs text-center">
                      <span className={r.atrasos > 0 ? "text-accent-amber font-medium" : "text-muted"}>{r.atrasos}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => setDrawerUser(drawerUser?.userId === r.userId ? null : r)}
                        className="flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Eye size={12} /> Detalhes
                      </button>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mx-auto mb-4">
                      <BarChart3 size={28} className="text-muted/50" />
                    </div>
                    <p className="text-sm font-bold text-primary mb-1">Nenhum relatório encontrado</p>
                    <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
                      {hasActiveFilters
                        ? "Nenhum colaborador corresponde aos filtros aplicados. Tente ajustar os filtros."
                        : "Selecione outra competência ou ajuste os filtros para visualizar os dados."
                      }
                    </p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters}
                        className="mt-4 h-8 px-4 rounded-lg bg-[var(--accent-primary)] text-[11px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-all"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all disabled:opacity-30"
            >
              <ChevronRight size={13} className="rotate-180" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6))
              return start + i
            }).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-[11px] font-semibold transition-all ${p === page ? "bg-[var(--accent-primary)] text-white" : "text-muted hover:text-primary hover:bg-elevated"}`}
              >{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all disabled:opacity-30"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Advanced Filters Drawer */}
      {showAdvancedFilters && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdvancedFilters(false)} />
          <div className="relative w-full max-w-sm bg-surface border-l border-default shadow-modal overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 flex items-center justify-between p-5 border-b border-default bg-surface z-10">
              <div>
                <h3 className="text-sm font-bold text-primary">Filtros Avançados</h3>
                <p className="text-[11px] text-secondary">Filtrar por cargo e status</p>
              </div>
              <button onClick={() => setShowAdvancedFilters(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Cargo</label>
                <select value={positionId} onChange={e => setPositionId(e.target.value)} disabled={!positions.length}
                  className="h-9 px-2.5 rounded-lg border border-default bg-input text-xs text-primary outline-none focus:border-[var(--accent-ring)] disabled:opacity-40 w-full"
                >
                  <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Todos os Cargos</option>
                  {positions.map((p: any) => <option key={p.id} value={p.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{p.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-default bg-input text-xs text-primary outline-none focus:border-[var(--accent-ring)] w-full"
                >
                  <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Todos</option>
                  <option value="ok" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">OK</option>
                  <option value="alerta" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Alerta</option>
                  <option value="pendente" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Pendente</option>
                  <option value="incompleto" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Incompleto</option>
                </select>
              </div>
              {(positionId || statusFilter) && (
                <button onClick={() => { setPositionId(""); setStatusFilter("") }}
                  className="w-full h-9 rounded-lg border border-default text-[11px] font-medium text-muted hover:text-primary hover:bg-elevated/20 transition-all"
                >
                  Limpar filtros avançados
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {drawerUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerUser(null)} />
          <div className="relative w-full max-w-xl bg-surface border-l border-default shadow-modal overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 flex items-center justify-between p-5 border-b border-default bg-surface z-10">
              <div>
                <h3 className="text-base font-bold text-primary">{drawerUser.colaborador}</h3>
                <p className="text-xs text-secondary">{drawerUser.departamento} · {drawerUser.cargo}</p>
              </div>
              <button onClick={() => setDrawerUser(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all">
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Horas Trabalhadas", value: fmtMins(drawerUser.horasTrabalhadas), color: "text-accent-purple" },
                  { label: "Horas Extras", value: fmtMins(drawerUser.horasExtras), color: "text-accent-amber" },
                  { label: "Saldo Banco", value: `${drawerUser.saldoBanco >= 0 ? "+" : ""}${fmtMins(Math.abs(drawerUser.saldoBanco))}`, color: drawerUser.saldoBanco >= 0 ? "text-accent-green" : "text-accent-red" },
                  { label: "Dias Trabalhados", value: `${drawerUser.diasTrabalhados}/${drawerUser.diasUteis}`, color: "text-primary" },
                  { label: "Faltas", value: String(drawerUser.faltas), color: drawerUser.faltas > 0 ? "text-accent-red" : "text-muted" },
                  { label: "Atrasos", value: String(drawerUser.atrasos), color: drawerUser.atrasos > 0 ? "text-accent-amber" : "text-muted" },
                ].map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5 p-3 rounded-lg bg-elevated/20">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">{item.label}</span>
                    <span className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Justifications */}
              {drawerUser.justificativas.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-primary mb-3">Justificativas</h4>
                  <div className="flex flex-col gap-2">
                    {drawerUser.justificativas.map((j, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-elevated/20 text-[11px]">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${j.status === "APPROVED" ? "bg-accent-green/10" : j.status === "REJECTED" ? "bg-accent-red/10" : "bg-accent-amber/10"}`}>
                          {j.status === "APPROVED" ? <ShieldCheck size={11} className="text-accent-green" /> : j.status === "REJECTED" ? <X size={11} className="text-accent-red" /> : <AlertTriangle size={11} className="text-accent-amber" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-primary">{j.motivo}</p>
                          <p className="text-muted">{fmtDate(j.inicio)} → {fmtDate(j.fim)}</p>
                        </div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${j.status === "APPROVED" ? "bg-accent-green/10 text-accent-green" : j.status === "REJECTED" ? "bg-accent-red/10 text-accent-red" : "bg-accent-amber/10 text-accent-amber"}`}>
                          {j.status === "APPROVED" ? "Aprovado" : j.status === "REJECTED" ? "Recusado" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily records */}
              <div>
                <h4 className="text-xs font-bold text-primary mb-3">Registros do Período</h4>
                {drawerUser.registros.length === 0 ? (
                  <p className="text-[11px] text-muted">Nenhum registro no período.</p>
                ) : (
                  <div className="flex flex-col">
                    {drawerUser.registros.map((reg, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-default last:border-b-0 text-[11px]">
                        <span className="w-24 font-medium text-primary">{fmtDate(reg.data)}</span>
                        <span className="w-16 text-center font-mono text-secondary">{reg.entrada || "---"}</span>
                        <span className="w-16 text-center font-mono text-secondary">{reg.saida || "---"}</span>
                        <span className="w-16 text-right font-mono font-medium text-primary">{reg.totalMinutos != null ? fmtMins(reg.totalMinutos) : "---"}</span>
                        {reg.extraMinutos > 0 && <span className="text-[9px] text-accent-amber font-medium">+{fmtMins(reg.extraMinutos)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>)}
    </div>
  )
}
