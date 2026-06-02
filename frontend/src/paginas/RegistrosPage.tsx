import { useState, useMemo } from "react"
import { Search, ChevronDown, ArrowUpDown, PencilLine, Eye, FileText, Trash2, X, Calendar, AlertTriangle } from "lucide-react"
import type { TimeRecord, Justificacao, FormData } from "../types"
import { formatDataBR } from "../types"
import { PageHeader } from "../componentes/PageHeader"
import { RegisterModal } from "../componentes/RegisterModal"
import { JustificacaoModal } from "../componentes/JustificacaoModal"
import { DayDetailModal } from "../componentes/DayDetailModal"

interface RegistrosPageProps {
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
  onEdit: (dataISO: string) => void
  onSave: (fd: FormData) => void
  onJustificar: (data: Justificacao) => void
  onDelete: (dataISO: string) => void
  headerless?: boolean
}

type PeriodoFilter = "todos" | "hoje" | "semana" | "mes"
type StatusFilter = "todos" | "normal" | "extra" | "pendente" | "justificado" | "afastamento"
type TipoFilter = "todos" | "Normal" | "Extra" | "Compensação" | "Afastamento" | "Negativo" | "Pendente"

function getStatusInfo(record: TimeRecord, justificacao?: Justificacao): { label: string; color: string; bg: string } {
  if (record.tipo === "Pendente") {
    if (!justificacao) return { label: "Pendente", color: "text-[#C49A6B]", bg: "bg-[#C49A6B]/10" }
    if (justificacao.status === "aprovado") return { label: "Justificado", color: "text-[#5B9B7A]", bg: "bg-[#5B9B7A]/10" }
    if (justificacao.status === "recusado") return { label: "Recusado", color: "text-[#C96B6B]", bg: "bg-[#C96B6B]/10" }
    return { label: "Em análise", color: "text-[var(--accent-hover)]", bg: "bg-[var(--accent-hover)]/10" }
  }
  if (record.tipo === "Extra") return { label: "Extra", color: "text-[var(--accent-hover)]", bg: "bg-[var(--accent-hover)]/10" }
  if (record.tipo === "Compensação") return { label: "Compensação", color: "text-[var(--accent-primary)]", bg: "bg-[var(--accent-primary)]/8" }
  if (record.tipo === "Negativo") return { label: "Negativo", color: "text-[#C96B6B]", bg: "bg-[#C96B6B]/10" }
  if (record.tipo === "Afastamento") return { label: "Afastamento", color: "text-[#C96B6B]", bg: "bg-[#C96B6B]/10" }
  return { label: "Normal", color: "text-[#5B9B7A]", bg: "bg-[#5B9B7A]/10" }
}

export function RegistrosPage({ allRecords, justificacoes, onEdit, onSave, onJustificar, onDelete, headerless }: RegistrosPageProps) {
  const [periodo, setPeriodo] = useState<PeriodoFilter>("mes")
  const [status, setStatus] = useState<StatusFilter>("todos")
  const [tipo, setTipo] = useState<TipoFilter>("todos")
  const [search, setSearch] = useState("")
  const [colaborador, setColaborador] = useState("milena")
  const [showColabDropdown, setShowColabDropdown] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editDate, setEditDate] = useState<string | undefined>(undefined)
  const [justificarDate, setJustificarDate] = useState("")
  const [justificarOpen, setJustificarOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<TimeRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteConfirmISO, setDeleteConfirmISO] = useState<string | null>(null)

  const [showPeriodoDropdown, setShowPeriodoDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showTipoDropdown, setShowTipoDropdown] = useState(false)
  const [ordemCrescente, setOrdemCrescente] = useState(false)

  const filtered = useMemo(() => {
    let list = [...allRecords]

    const now = new Date()
    const today = now.toISOString().split("T")[0]
    if (periodo === "hoje") {
      list = list.filter((r) => r.dataISO === today)
    } else if (periodo === "semana") {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const friday = new Date(monday)
      friday.setDate(monday.getDate() + 4)
      const start = monday.toISOString().split("T")[0]
      const end = friday.toISOString().split("T")[0]
      list = list.filter((r) => r.dataISO >= start && r.dataISO <= end)
    } else if (periodo === "mes") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
      list = list.filter((r) => r.dataISO >= monthStart && r.dataISO <= monthEnd)
    }

    if (status !== "todos") {
      list = list.filter((r) => {
        const info = getStatusInfo(r, justificacoes[r.dataISO])
        const label = info.label.toLowerCase()
        if (status === "normal") return label === "normal"
        if (status === "extra") return label === "extra"
        if (status === "pendente") return label === "pendente" || label === "em análise"
        if (status === "justificado") return label === "justificado"
        if (status === "afastamento") return label === "negativo"
        return true
      })
    }

    if (tipo !== "todos") {
      list = list.filter((r) => r.tipo === tipo)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) => r.data.toLowerCase().includes(q) || r.dataISO.includes(q))
    }

    return list.sort((a, b) => ordemCrescente
      ? a.dataISO.localeCompare(b.dataISO)
      : b.dataISO.localeCompare(a.dataISO))
  }, [allRecords, periodo, status, tipo, search, justificacoes, ordemCrescente])

  function handleEditClick(dataISO: string) {
    setEditDate(dataISO)
    setModalOpen(true)
  }

  function handleJustificarClick(dataISO: string) {
    setJustificarDate(dataISO)
    setJustificarOpen(true)
  }

  function handleSaveRecord(fd: FormData) {
    setModalOpen(false)
    setEditDate(undefined)
    onSave(fd)
  }

  function handleViewDetail(record: TimeRecord) {
    setDetailRecord(record)
    setDetailOpen(true)
  }

  function handleDeleteClick(dataISO: string) {
    setDeleteConfirmISO(dataISO)
  }

  function handleDeleteConfirm() {
    if (deleteConfirmISO) {
      onDelete(deleteConfirmISO)
      setDeleteConfirmISO(null)
    }
  }

  function buildActivityLogs(record: TimeRecord) {
    const logs: { action: "created" | "edited" | "exported" | "justified"; timestamp: string; user: string; detail?: string }[] = []
    const [y, m, d] = record.dataISO.split("-")
    const registeredTime = record.entrada !== "---" ? record.entrada : "08:00"
    logs.push({
      action: "created",
      timestamp: `${d}/${m}/${y} às ${registeredTime}`,
      user: "Milena Alves",
      detail: `Jornada: ${record.entrada} → ${record.saida} (${record.total})`,
    })
    if (record.tipo === "Extra" || record.tipo === "Compensação") {
      logs.push({
        action: "edited",
        timestamp: `${d}/${m}/${y} às 14:32`,
        user: "Milena Alves",
        detail: "Ajuste no tipo de registro",
      })
    }
    const just = justificacoes[record.dataISO]
    if (just) {
      const statusLabel = just.status === "aprovado" ? "aprovada" : just.status === "recusado" ? "recusada" : "em análise"
      logs.push({
        action: "justified",
        timestamp: `${d}/${m}/${y} às 10:15`,
        user: "Milena Alves",
        detail: `${just.motivo} — ${statusLabel}`,
      })
    }
    return logs
  }

  const PERIODO_LABELS: Record<PeriodoFilter, string> = {
    todos: "Todo período",
    hoje: "Hoje",
    semana: "Esta semana",
    mes: "Este mês",
  }

  const STATUS_LABELS: Record<StatusFilter, string> = {
    todos: "Todos os status",
    normal: "Normal",
    extra: "Extra",
    pendente: "Pendente",
    justificado: "Justificado",
    afastamento: "Negativo",
  }

  const TIPO_LABELS: Record<TipoFilter, string> = {
    todos: "Todos os tipos",
    Normal: "Normal",
    Extra: "Extra",
    Compensação: "Compensação",
    Afastamento: "Afastamento",
    Negativo: "Negativo",
    Pendente: "Pendente",
  }

  return (
    <div className="flex flex-col gap-8">
      {!headerless && (
        <PageHeader
          title="Registros"
          subtitle="Gerencie os registros de ponto do período."
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => { setShowPeriodoDropdown((p) => !p); setShowStatusDropdown(false); setShowTipoDropdown(false) }}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-default/20 bg-surface text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            <Calendar size={12} strokeWidth={2} />
            {PERIODO_LABELS[periodo]}
            <ChevronDown size={10} strokeWidth={2} className="text-muted" />
          </button>
          {showPeriodoDropdown && (
            <div className="absolute top-full left-0 mt-1 w-40 rounded-lg bg-elevated border border-default/50 shadow-modal overflow-hidden z-10">
              {(Object.entries(PERIODO_LABELS) as [PeriodoFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setPeriodo(key); setShowPeriodoDropdown(false) }}
                  className={`w-full px-3 py-2 text-xs font-medium text-left transition-all duration-200 ${
                    periodo === key ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/8" : "text-secondary hover:text-primary hover:bg-elevated"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowStatusDropdown((p) => !p); setShowPeriodoDropdown(false); setShowTipoDropdown(false) }}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-default/20 bg-surface text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            <FileText size={12} strokeWidth={2} />
            {STATUS_LABELS[status]}
            <ChevronDown size={10} strokeWidth={2} className="text-muted" />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 w-44 rounded-lg bg-elevated border border-default/50 shadow-modal overflow-hidden z-10">
              {(Object.entries(STATUS_LABELS) as [StatusFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setStatus(key); setShowStatusDropdown(false) }}
                  className={`w-full px-3 py-2 text-xs font-medium text-left transition-all duration-200 ${
                    status === key ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/8" : "text-secondary hover:text-primary hover:bg-elevated"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowTipoDropdown((p) => !p); setShowPeriodoDropdown(false); setShowStatusDropdown(false) }}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-default/20 bg-surface text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            <ChevronDown size={10} strokeWidth={2} className="text-muted" />
            {TIPO_LABELS[tipo]}
          </button>
          {showTipoDropdown && (
            <div className="absolute top-full left-0 mt-1 w-40 rounded-lg bg-elevated border border-default/50 shadow-modal overflow-hidden z-10">
              {(Object.entries(TIPO_LABELS) as [TipoFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setTipo(key); setShowTipoDropdown(false) }}
                  className={`w-full px-3 py-2 text-xs font-medium text-left transition-all duration-200 ${
                    tipo === key ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/8" : "text-secondary hover:text-primary hover:bg-elevated"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowColabDropdown((p) => !p); setShowPeriodoDropdown(false); setShowStatusDropdown(false); setShowTipoDropdown(false) }}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-default/20 bg-surface text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-muted" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="6" r="3" />
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
            {colaborador === "milena" ? "Milena Alves" : "Todos os colaboradores"}
            <ChevronDown size={10} strokeWidth={2} className="text-muted" />
          </button>
          {showColabDropdown && (
            <div className="absolute top-full left-0 mt-1 w-44 rounded-lg bg-elevated border border-default/50 shadow-modal overflow-hidden z-10">
              <button
                onClick={() => { setColaborador("milena"); setShowColabDropdown(false) }}
                className={`w-full px-3 py-2 text-xs font-medium text-left transition-all duration-200 ${
                  colaborador === "milena" ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/8" : "text-secondary hover:text-primary hover:bg-elevated"
                }`}
              >
                Milena Alves
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setOrdemCrescente((p) => !p)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
            ordemCrescente
              ? "border-[var(--accent-primary)]/30 text-[var(--accent-primary)] bg-[var(--accent-primary)]/8"
              : "border-default/20 bg-surface text-muted hover:text-secondary hover:bg-elevated"
          }`}
          title={ordemCrescente ? "Mais antigos primeiro" : "Mais recentes primeiro"}
        >
          <ArrowUpDown size={12} strokeWidth={2} />
          <span className="hidden sm:inline">{ordemCrescente ? "ASC" : "DESC"}</span>
        </button>

        <div className="flex-1 min-w-[160px] max-w-[220px] relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por data..."
            className="w-full h-8 pl-7 pr-7 rounded-lg border border-default/20 bg-surface text-xs text-primary placeholder-muted outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors">
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        <span className="text-[11px] text-muted font-medium">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-elevated/50 h-px" />

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <th className="text-left py-3 pr-4 font-medium">Data</th>
              <th className="text-center py-3 px-3 font-medium w-[80px]">Entrada</th>
              <th className="text-center py-3 px-3 font-medium w-[80px]">Intervalo</th>
              <th className="text-center py-3 px-3 font-medium w-[80px]">Saída</th>
              <th className="text-center py-3 px-3 font-medium w-[80px]">Total</th>
              <th className="text-center py-3 px-3 font-medium w-[80px]">Tipo</th>
              <th className="text-center py-3 px-3 font-medium w-[120px]">Status</th>
              <th className="text-right py-3 pl-4 font-medium w-[100px]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const just = justificacoes[r.dataISO]
              const statusInfo = getStatusInfo(r, just)
              const isPending = r.tipo === "Pendente"
              return (
                <tr
                  key={r.id}
                  className="group transition-all duration-200 hover:bg-elevated/20 dark:hover:bg-white/[0.02] border-b border-default last:border-b-0"
                >
                  <td className="py-3 pr-4">
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${isPending ? "text-[#C49A6B]" : "text-primary"}`}>
                        {r.data}
                      </span>
                      <span className="text-[10px] text-muted">{r.dataISO}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-sm font-mono tracking-wide ${isPending ? "text-muted" : "text-secondary"}`}>
                      {isPending ? "---" : r.entrada}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className={`flex flex-col items-center gap-0.5 ${isPending ? "text-muted" : "text-secondary"}`}>
                      {isPending ? (
                        <span className="text-sm font-mono tracking-wide">---</span>
                      ) : (
                        <>
                          <span className="text-sm font-mono tracking-wide leading-tight">{r.saidaIntervalo}</span>
                          <span className="text-xs font-mono tracking-wide text-muted/60 leading-tight">{r.retornoIntervalo}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-sm font-mono tracking-wide ${isPending ? "text-muted" : "text-secondary"}`}>
                      {isPending ? "---" : r.saida}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-sm font-mono font-semibold ${isPending ? "text-muted" : "text-primary"}`}>
                      {isPending ? "---" : r.total}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                      {isPending ? "Pendente" : r.tipo}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button
                        onClick={() => handleEditClick(r.dataISO)}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/8 transition-all duration-200"
                        title="Editar"
                      >
                        <PencilLine size={12} strokeWidth={2} />
                      </button>
                      <button
                          onClick={() => handleViewDetail(r)}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-[var(--accent-hover)] hover:bg-[var(--accent-hover)]/8 transition-all duration-200"
                          title="Visualizar"
                        >
                          <Eye size={12} strokeWidth={2} />
                        </button>
                      {isPending && !just && (
                        <button
                          onClick={() => handleJustificarClick(r.dataISO)}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-[#5B9B7A] hover:bg-[#5B9B7A]/8 transition-all duration-200"
                          title="Justificar"
                        >
                          <FileText size={12} strokeWidth={2} />
                        </button>
                      )}
                      <button
                          onClick={() => handleDeleteClick(r.dataISO)}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-[#C96B6B] hover:bg-[#C96B6B]/8 transition-all duration-200"
                          title="Excluir"
                        >
                          <Trash2 size={12} strokeWidth={2} />
                        </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={24} className="text-muted/50" strokeWidth={1.5} />
                    <p className="text-sm text-muted">Nenhum registro encontrado.</p>
                    <p className="text-[11px] text-muted/70">Tente ajustar os filtros ou criar um novo registro.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RegisterModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditDate(undefined) }}
        onSave={handleSaveRecord}
        editDate={editDate}
      />

      <JustificacaoModal
        open={justificarOpen}
        onClose={() => setJustificarOpen(false)}
        onSave={(data) => { setJustificarOpen(false); onJustificar(data) }}
        defaultDate={justificarDate}
      />

      <DayDetailModal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailRecord(null) }}
        record={detailRecord}
        onEdit={(iso) => { setDetailOpen(false); setDetailRecord(null); onEdit(iso) }}
        activityLogs={detailRecord ? buildActivityLogs(detailRecord) : undefined}
      />

      {deleteConfirmISO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmISO(null)} />
          <div className="relative w-full max-w-sm mx-4 bg-surface border border-default/40 dark:border-white/6 rounded-xl p-5 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setDeleteConfirmISO(null)}
              className="absolute top-4 right-4 md:w-11 md:h-11 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-col gap-1 mb-5">
              <h2 className="text-lg font-bold text-primary tracking-tight">Excluir registro</h2>
              <p className="text-sm text-secondary">Tem certeza que deseja excluir o registro do dia <strong className="text-primary">{deleteConfirmISO ? formatDataBR(deleteConfirmISO) : ""}</strong>?</p>
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#C96B6B]/8 mb-5">
              <AlertTriangle size={14} className="text-[#C96B6B] shrink-0" strokeWidth={2} />
              <span className="text-[11px] text-[#C96B6B] font-medium">Esta ação não pode ser desfeita.</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setDeleteConfirmISO(null)}
                className="flex-1 h-11 rounded-lg bg-surface border border-default/50 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 h-11 rounded-lg bg-[#C96B6B] text-sm font-semibold text-white hover:bg-[#C96B6B]/80 transition-all duration-200"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
