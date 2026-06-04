import { useState, useEffect, useMemo } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import ptBrLocale from "@fullcalendar/core/locales/pt-br"
import type { EventClickArg, EventContentArg } from "@fullcalendar/core"
import {
  Umbrella, CalendarCheck, Users, Clock, CheckCircle,
  Search, MoreHorizontal, Eye, ThumbsUp, ThumbsDown, Edit3, X, Plus,
  ChevronLeft, ChevronRight, Loader2, Calendar, ClipboardList,
} from "lucide-react"
import { team as apiTeam, notifications as apiNotifs } from "../services/api"
import { PageHeader } from "../componentes/PageHeader"

interface TeamMember {
  id: string; name: string; email: string; role: string; department: string | null; departmentId: string | null; hireDate: string; isActive?: boolean
}

interface FeriasRecord {
  id: string
  collaboratorId: string
  collaboratorName: string
  startDate: string
  endDate: string
  days: number
  requestedAt: string
  status: "aprovado" | "pendente" | "rejeitado" | "em_andamento"
  notes?: string
}



const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  aprovado: { label: "Aprovado", bg: "bg-accent-green/10", color: "text-accent-green" },
  pendente: { label: "Pendente", bg: "bg-accent-amber/10", color: "text-accent-amber" },
  rejeitado: { label: "Rejeitado", bg: "bg-accent-red/10", color: "text-accent-red" },
  em_andamento: { label: "Em andamento", bg: "bg-[var(--accent-primary)]/10", color: "text-[var(--accent-primary)]" },
}

const ITEMS_PER_PAGE = 10

function fmtDate(iso: string): string {
  if (!iso) return "---"
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR")
}

function avatarFallback(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || "??"
}

export function FeriasPage() {
  const [records, setRecords] = useState<FeriasRecord[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [deptFilter, setDeptFilter] = useState("")
  const [activeTab, setActiveTab] = useState<"lista" | "calendario" | "analise">("lista")
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [newCollaboratorId, setNewCollaboratorId] = useState("")
  const [newStart, setNewStart] = useState("")
  const [newEnd, setNewEnd] = useState("")
  const [newNotes, setNewNotes] = useState("")

  const [viewRecord, setViewRecord] = useState<FeriasRecord | null>(null)
  const [analyzeRecord, setAnalyzeRecord] = useState<FeriasRecord | null>(null)
  const [confirmResult, setConfirmResult] = useState<{ record: FeriasRecord; action: "aprovado" | "rejeitado" } | null>(null)

  const closeMenu = () => setOpenMenuId(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest("[data-menu]")) closeMenu()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    apiTeam.enriched()
      .then(members => {
        setTeamMembers(members)
        if (members.length > 0) setNewCollaboratorId(members[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeTeamMembers = useMemo(() => teamMembers.filter(m => m.isActive !== false), [teamMembers])

  const programmed = records.filter(r => r.status === "aprovado" || r.status === "em_andamento").length
  const active = records.filter(r => r.status === "em_andamento").length
  const pending = records.filter(r => r.status === "pendente").length
  const concluded = records.filter(r => r.status === "aprovado").filter(r => new Date(r.endDate) < new Date()).length

  const filtered = useMemo(() => {
    let list = [...records]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.collaboratorName.toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter(r => r.status === statusFilter)
    if (deptFilter) {
      const memberIds = activeTeamMembers.filter(m => m.departmentId === deptFilter).map(m => m.id)
      list = list.filter(r => memberIds.includes(r.collaboratorId))
    }
    return list
  }, [records, search, statusFilter, deptFilter, activeTeamMembers])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  useEffect(() => { setPage(1) }, [search, statusFilter, deptFilter])

  function handleNewRequest() {
    const member = activeTeamMembers.find(m => m.id === newCollaboratorId)
    const start = new Date(newStart + "T12:00:00")
    const end = new Date(newEnd + "T12:00:00")
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    const todayLocal = new Date()
    const todayLocalStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`
    const record: FeriasRecord = {
      id: `f${Date.now()}`,
      collaboratorId: newCollaboratorId,
      collaboratorName: member?.name || "Desconhecido",
      startDate: newStart,
      endDate: newEnd,
      days,
      requestedAt: todayLocalStr,
      status: "pendente",
      notes: newNotes || undefined,
    }
    setRecords(prev => [record, ...prev])
    setShowNewModal(false)
    setNewCollaboratorId(activeTeamMembers[0]?.id || "")
    setNewStart("")
    setNewEnd("")
    setNewNotes("")
  }

  function handleApprove(id: string) {
    const record = records.find(r => r.id === id)
    if (!record) return
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: "aprovado" as const } : r))
    setOpenMenuId(null)
    setAnalyzeRecord(null)
    setConfirmResult({ record, action: "aprovado" })
    const member = teamMembers.find(m => m.id === record.collaboratorId)
    apiNotifs.create({
      title: "Férias aprovadas",
      message: `As férias de ${record.collaboratorName} foram aprovadas.`,
      type: "APPROVAL",
      collaboratorEmail: member?.email,
      collaboratorName: record.collaboratorName,
      period: `${fmtDate(record.startDate)} — ${fmtDate(record.endDate)}`,
      sendEmail: !!member?.email,
    }).catch(() => {})
  }

  function handleReject(id: string) {
    const record = records.find(r => r.id === id)
    if (!record) return
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: "rejeitado" as const } : r))
    setOpenMenuId(null)
    setAnalyzeRecord(null)
    setConfirmResult({ record, action: "rejeitado" })
    const member = teamMembers.find(m => m.id === record.collaboratorId)
    apiNotifs.create({
      title: "Férias recusadas",
      message: `As férias de ${record.collaboratorName} foram recusadas.`,
      type: "WARNING",
      collaboratorEmail: member?.email,
      collaboratorName: record.collaboratorName,
      period: `${fmtDate(record.startDate)} — ${fmtDate(record.endDate)}`,
      sendEmail: !!member?.email,
    }).catch(() => {})
  }

  const departments = useMemo(() => {
    const map = new Map<string, string>()
    activeTeamMembers.forEach(m => {
      if (m.departmentId && m.department) map.set(m.departmentId, m.department)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [activeTeamMembers])

  const fcEvents = useMemo(() => {
    const active = records.filter(r => r.status === "aprovado" || r.status === "em_andamento")
    return active.map(r => ({
      id: r.id,
      title: r.collaboratorName,
      start: r.startDate,
      end: (() => {
        const d = new Date(r.endDate + "T12:00:00")
        d.setDate(d.getDate() + 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      })(),
      backgroundColor: r.status === "em_andamento" ? "var(--accent-primary)" : "#10b981",
      borderColor: "transparent",
      textColor: "#fff",
      classNames: ["rounded-md text-[11px] px-1"],
    }))
  }, [records])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Férias"
        subtitle="Acompanhe e gerencie as férias dos colaboradores."
        actions={
          <button onClick={() => setShowNewModal(true)}
            className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 flex items-center gap-2"
          >
            <Plus size={15} strokeWidth={2} />
            Nova Solicitação
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-elevated/20 w-fit">
        <button onClick={() => setActiveTab("lista")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
            activeTab === "lista" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"
          }`}
        >
          <Umbrella size={14} strokeWidth={1.5} />
          Lista
        </button>
        <button onClick={() => setActiveTab("calendario")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
            activeTab === "calendario" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"
          }`}
        >
          <Calendar size={14} strokeWidth={1.5} />
          Calendário Anual
        </button>
        <button onClick={() => setActiveTab("analise")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
            activeTab === "analise" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"
          }`}
        >
          <ClipboardList size={14} strokeWidth={1.5} />
          Pedidos para Análise
        </button>
      </div>

      {/* Metric cards */}
      <div className="flex items-stretch">
        {[
          { label: "Férias programadas", icon: CalendarCheck, value: programmed, color: "text-[var(--accent-primary)]" },
          { label: "Colaboradores em férias", icon: Users, value: active, color: "text-blue-400" },
          { label: "Solicitações pendentes", icon: Clock, value: pending, color: "text-[var(--accent-amber)]" },
          { label: "Férias concluídas", icon: CheckCircle, value: concluded, color: "text-[var(--accent-green)]" },
        ].map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="flex-1 flex flex-col gap-1.5 p-5 border-r border-default last:border-r-0">
              <div className="flex items-center gap-2">
                <Icon size={14} className={c.color} />
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{c.label}</span>
              </div>
              <span className="text-xl font-bold text-primary">{c.value}</span>
            </div>
          )
        })}
      </div>

      {activeTab === "lista" ? (
        <>
          {/* Search + Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" strokeWidth={2} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por colaborador..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-default/20 bg-input text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200"
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-default/20 bg-input text-xs text-primary focus:outline-none focus:border-[var(--accent-ring)]"
            >
              <option value="">Status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="em_andamento">Em andamento</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-default/20 bg-input text-xs text-primary focus:outline-none focus:border-[var(--accent-ring)]"
            >
              <option value="">Departamento</option>
              {departments.map(d => (
                <option key={d.id} value={d.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{d.name}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-4">Colaborador</th>
                  <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-4">Período</th>
                  <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-4">Dias</th>
                  <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-4">Solicitado em</th>
                  <th className="text-left text-xs text-muted font-semibold uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-right text-xs text-muted font-semibold uppercase tracking-wider pb-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => {
                  const st = STATUS_CONFIG[r.status]
                  return (
                    <tr key={r.id} className="group transition-all duration-200 hover:bg-elevated/20 dark:hover:bg-white/[0.02] border-b border-default last:border-b-0">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {avatarFallback(r.collaboratorName)}
                          </div>
                          <span className="text-sm font-semibold text-primary">{r.collaboratorName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-primary">
                        {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-primary font-medium">{r.days}d</td>
                      <td className="py-3.5 pr-4 text-sm text-secondary">{fmtDate(r.requestedAt)}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div data-menu className="relative inline-flex">
                          <button onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal size={14} strokeWidth={2} />
                          </button>
                          {openMenuId === r.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl bg-surface border border-default/30 shadow-modal py-1 animate-in fade-in duration-150">
                              <button onClick={() => { setViewRecord(r); setOpenMenuId(null) }}
                                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[11px] font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-150"
                              >
                                <Eye size={13} strokeWidth={1.5} /> Visualizar
                              </button>
                              {r.status === "pendente" && (
                                <>
                                  <button onClick={() => handleApprove(r.id)}
                                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[11px] font-medium text-accent-green hover:bg-accent-green/8 transition-all duration-150"
                                  >
                                    <ThumbsUp size={13} strokeWidth={1.5} /> Aprovar
                                  </button>
                                  <button onClick={() => handleReject(r.id)}
                                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[11px] font-medium text-accent-red hover:bg-accent-red/8 transition-all duration-150"
                                  >
                                    <ThumbsDown size={13} strokeWidth={1.5} /> Rejeitar
                                  </button>
                                </>
                              )}
                              <button
                                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[11px] font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-150"
                              >
                                <Edit3 size={13} strokeWidth={1.5} /> Editar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Umbrella size={24} className="text-muted/50" strokeWidth={1.5} />
                        <p className="text-sm text-muted">Nenhum registro encontrado.</p>
                        <p className="text-[11px] text-muted/70">Tente ajustar a busca ou filtros.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                ><ChevronLeft size={14} strokeWidth={2} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      p === page ? "bg-[var(--accent-primary)] text-white" : "text-muted hover:text-primary hover:bg-elevated"
                    }`}
                  >{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                ><ChevronRight size={14} strokeWidth={2} /></button>
              </div>
            </div>
          )}
        </>
      ) : activeTab === "calendario" ? (
        /* Calendar View */
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-surface border border-default/20 p-3 overflow-x-auto">
            <style>{`
              .fc .fc-toolbar-title { font-size: 0.875rem !important; font-weight: 600 !important; }
              .fc .fc-button { font-size: 0.7rem !important; padding: 0.2rem 0.5rem !important; height: auto !important; }
              .fc .fc-toolbar { margin-bottom: 0.5rem !important; }
              .fc .fc-daygrid-day-frame { padding: 1px !important; min-height: 2rem !important; }
              .fc .fc-daygrid-day-number { font-size: 0.65rem !important; padding: 2px !important; }
              .fc .fc-daygrid-more-link { font-size: 0.6rem !important; }
              .fc .fc-scrollgrid { border: none !important; }
              .fc td, .fc th { border-color: var(--border-default) !important; }
              .fc-theme-standard .fc-scrollgrid { border: 1px solid var(--border-default) !important; }
              .fc .fc-col-header-cell-cushion { font-size: 0.65rem !important; padding: 4px 0 !important; font-weight: 600 !important; color: var(--text-muted) !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; }
              .fc .fc-day-today { background: var(--accent-primary)/0.05 !important; }
            `}</style>
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              events={fcEvents}
              height="auto"
              aspectRatio={2.2}
              firstDay={0}
              locale={ptBrLocale}
              allDayText=""
              noEventsText="Nenhuma férias programada"
              eventContent={(arg: EventContentArg) => (
                <div className="text-[9px] font-medium truncate px-0.5 leading-tight">
                  <span>{arg.event.title}</span>
                </div>
              )}
              eventClick={(arg: EventClickArg) => {
                const record = records.find(r => r.id === arg.event.id)
                if (record) setViewRecord(record)
              }}
              buttonText={{ today: "Hoje" }}
              editable={false}
              selectable={false}
            />
          </div>
          <div className="flex items-center gap-6 px-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#10b981]" />
              <span className="text-[11px] text-muted">Aprovado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#6366f1]" />
              <span className="text-[11px] text-muted">Em andamento</span>
            </div>
          </div>
        </div>
      ) : (
        /* Pedidos para Análise */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">{records.filter(r => r.status === "pendente").length} solicitação(ões) aguardando análise</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {records.filter(r => r.status === "pendente").map(r => (
              <div key={r.id} className="rounded-xl bg-surface border border-default/20 hover:shadow-md transition-all duration-200 overflow-hidden">
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {avatarFallback(r.collaboratorName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{r.collaboratorName}</p>
                      <span className="text-[11px] text-amber-400 font-medium">{STATUS_CONFIG[r.status].label}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-elevated/20 col-span-2">
                      <span className="text-muted uppercase tracking-wider font-semibold">Período</span>
                      <span className="text-primary font-medium">{fmtDate(r.startDate)} — {fmtDate(r.endDate)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-elevated/20">
                      <span className="text-muted uppercase tracking-wider font-semibold">Dias</span>
                      <span className="text-primary font-medium">{r.days}d</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-elevated/20 col-span-3">
                      <span className="text-muted uppercase tracking-wider font-semibold">Solicitado em</span>
                      <span className="text-primary font-medium">{fmtDate(r.requestedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex border-t border-default/20">
                  <button onClick={() => setAnalyzeRecord(r)}
                    className="flex-1 py-2.5 text-[11px] font-semibold text-primary hover:bg-elevated/30 transition-all duration-150 text-center"
                  >
                    Analisar
                  </button>
                </div>
              </div>
            ))}
            {records.filter(r => r.status === "pendente").length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-2 py-16">
                <ClipboardList size={24} className="text-muted/50" strokeWidth={1.5} />
                <p className="text-sm text-muted">Nenhum pedido pendente.</p>
                <p className="text-[11px] text-muted/70">Todas as solicitações já foram analisadas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nova Solicitação Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowNewModal(false)}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                  <Umbrella size={16} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">Nova Solicitação de Férias</h3>
                  <p className="text-xs text-secondary">Registre um novo período de férias</p>
                </div>
              </div>
              <button onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleNewRequest() }} className="p-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Colaborador *</label>
                <select required value={newCollaboratorId} onChange={e => setNewCollaboratorId(e.target.value)}
                  className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]"
                >
                  {activeTeamMembers.map(m => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Data início *</label>
                  <input required type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary focus:outline-none focus:border-[var(--accent-ring)]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Data fim *</label>
                  <input required type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary focus:outline-none focus:border-[var(--accent-ring)]" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Observações</label>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  placeholder="Observações sobre a solicitação..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] resize-none transition-all"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="flex-1 h-10 rounded-lg bg-surface border border-default/20 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all"
                >Cancelar</button>
                <button type="submit"
                  className="flex-1 h-10 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all flex items-center justify-center gap-2"
                >
                  <Umbrella size={13} strokeWidth={2} />
                  Solicitar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visualizar Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setViewRecord(null)}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                  <Umbrella size={16} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">Solicitação de Férias</h3>
                  <p className="text-xs text-secondary">{viewRecord.collaboratorName}</p>
                </div>
              </div>
              <button onClick={() => setViewRecord(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Colaborador", value: viewRecord.collaboratorName },
                  { label: "Período", value: `${fmtDate(viewRecord.startDate)} — ${fmtDate(viewRecord.endDate)}` },
                  { label: "Dias", value: `${viewRecord.days} dias` },
                  { label: "Solicitado em", value: fmtDate(viewRecord.requestedAt) },
                  { label: "Status", value: STATUS_CONFIG[viewRecord.status].label, isStatus: true },
                ].map(item => (
                  <div key={item.label} className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">{item.label}</span>
                    {item.isStatus ? (
                      <span className={`text-[10px] font-semibold self-start px-2 py-0.5 rounded-full ${STATUS_CONFIG[viewRecord.status].bg} ${STATUS_CONFIG[viewRecord.status].color}`}>
                        {item.value}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-primary">{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
              {viewRecord.notes && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Observações</span>
                  <p className="text-xs text-primary">{viewRecord.notes}</p>
                </div>
              )}
              {viewRecord.status === "pendente" && (
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => { handleApprove(viewRecord.id); setViewRecord(null) }}
                    className="flex-1 h-10 rounded-lg bg-accent-green text-xs font-semibold text-white hover:bg-accent-green/80 transition-all flex items-center justify-center gap-2"
                  >
                    <ThumbsUp size={13} strokeWidth={2} /> Aprovar
                  </button>
                  <button onClick={() => { handleReject(viewRecord.id); setViewRecord(null) }}
                    className="flex-1 h-10 rounded-lg bg-accent-red text-xs font-semibold text-white hover:bg-accent-red/80 transition-all flex items-center justify-center gap-2"
                  >
                    <ThumbsDown size={13} strokeWidth={2} /> Rejeitar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analisar Modal */}
      {analyzeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setAnalyzeRecord(null)}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
                  <ClipboardList size={16} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">Analisar Solicitação</h3>
                  <p className="text-xs text-secondary">{analyzeRecord.collaboratorName}</p>
                </div>
              </div>
              <button onClick={() => setAnalyzeRecord(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  const member = teamMembers.find(m => m.id === analyzeRecord.collaboratorId)
                  return [
                    { label: "Colaborador", value: analyzeRecord.collaboratorName },
                    { label: "Admissão", value: member?.hireDate ? fmtDate(member.hireDate) : "---" },
                    { label: "Período", value: `${fmtDate(analyzeRecord.startDate)} — ${fmtDate(analyzeRecord.endDate)}` },
                    { label: "Dias", value: `${analyzeRecord.days} dias` },
                    { label: "Solicitado em", value: fmtDate(analyzeRecord.requestedAt) },
                  ]
                })().map(item => (
                  <div key={item.label} className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">{item.label}</span>
                    <span className="text-xs font-medium text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
              {analyzeRecord.notes && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Observações</span>
                  <p className="text-xs text-primary">{analyzeRecord.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-3 pt-3 border-t border-default/10">
                <button onClick={() => { handleReject(analyzeRecord.id); setAnalyzeRecord(null) }}
                  className="flex-1 h-11 rounded-lg border border-accent-red/30 text-xs font-semibold text-accent-red hover:bg-accent-red/8 transition-all flex items-center justify-center gap-2"
                >
                  <ThumbsDown size={14} strokeWidth={2} /> Recusar
                </button>
                <button onClick={() => { handleApprove(analyzeRecord.id); setAnalyzeRecord(null) }}
                  className="flex-1 h-11 rounded-lg bg-accent-green text-xs font-semibold text-white hover:bg-accent-green/80 transition-all flex items-center justify-center gap-2"
                >
                  <ThumbsUp size={14} strokeWidth={2} /> Aprovar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação Modal */}
      {confirmResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmResult(null)}>
          <div className="w-full max-w-md mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-4 py-10 px-8 text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                confirmResult.action === "aprovado" ? "bg-accent-green/10" : "bg-accent-red/10"
              }`}>
                {confirmResult.action === "aprovado" ? (
                  <ThumbsUp size={28} className="text-accent-green" strokeWidth={1.5} />
                ) : (
                  <ThumbsDown size={28} className="text-accent-red" strokeWidth={1.5} />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-primary">
                  {confirmResult.action === "aprovado" ? "Férias aprovadas" : "Férias recusadas"}
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Solicitação de <strong>{confirmResult.record.collaboratorName}</strong> foi {confirmResult.action === "aprovado" ? "aprovada" : "recusada"} com sucesso.
                </p>
              </div>
              <div className="w-full flex flex-col gap-1.5 p-3 rounded-lg bg-elevated/20 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted">Período</span>
                  <span className="text-primary font-medium">{fmtDate(confirmResult.record.startDate)} — {fmtDate(confirmResult.record.endDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Dias</span>
                  <span className="text-primary font-medium">{confirmResult.record.days}d</span>
                </div>
              </div>
              <button onClick={() => setConfirmResult(null)}
                className="w-full h-10 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
        </div>
      )}
    </div>
  )
}
