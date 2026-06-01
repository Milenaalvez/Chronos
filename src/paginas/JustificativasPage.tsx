import { useState, useEffect } from "react"
import { FileText, CheckCircle, XCircle, AlertTriangle, ShieldCheck, Loader2, ChevronDown, ExternalLink } from "lucide-react"
import { PageHeader } from "../componentes/PageHeader"
import { justifications as apiJust } from "../services/api"

interface JustItem {
  id: string
  reason: string
  description: string | null
  status: string
  rhResponse: string | null
  startDate: string
  endDate: string
  createdAt: string
  userId: string
  user: { id: string; name: string; email: string; avatar: string | null; department: string | null }
}

function fmtDate(d: string): string {
  try { return new Date(d.substring(0, 10)).toLocaleDateString("pt-BR") } catch { return d }
}

function fmtRel(d: string): string {
  try {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  } catch { return "" }
}

export function JustificativasPage() {
  const [justifications, setJustifications] = useState<JustItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selJust, setSelJust] = useState<JustItem | null>(null)
  const [rejectText, setRejectText] = useState("")
  const [justLoading, setJustLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJusts = async () => {
    setLoading(true)
    try {
      const data = await apiJust.list()
      setJustifications(data || [])
    } catch {
      setJustifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJusts()
  }, [])

  const pendingJusts = justifications.filter(j => j.status === "PENDING")

  const handleApprove = async (id: string) => {
    setJustLoading(true)
    setError(null)
    try {
      await (apiJust as any).approve(id)
      await fetchJusts()
      setSelJust(null)
    } catch (err: any) {
      setError(err?.message || "Erro ao aprovar")
    } finally {
      setJustLoading(false)
    }
  }

  const handleReject = async (id: string) => {
    setJustLoading(true)
    setError(null)
    try {
      await (apiJust as any).reject(id, rejectText || undefined)
      await fetchJusts()
      setSelJust(null)
      setRejectText("")
    } catch (err: any) {
      setError(err?.message || "Erro ao rejeitar")
    } finally {
      setJustLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Justificativas"
        subtitle="Gerencie as justificativas de registro de ponto"
      />

      {pendingJusts.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-amber)]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
            <span className="text-[11px] font-medium text-[var(--accent-amber)]">{pendingJusts.length} pendente{pendingJusts.length !== 1 ? "s" : ""}</span>
          </div>
          <span className="text-[11px] text-muted">{justifications.length} no total</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--accent-red)]/8 border border-[var(--accent-red)]/10">
          <AlertTriangle size="14" className="text-[var(--accent-red)] shrink-0" />
          <p className="text-xs font-medium text-[var(--accent-red)]">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-elevated/20 animate-pulse rounded-xl" />)}
        </div>
      ) : justifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
            <ShieldCheck size="28" className="text-muted" />
          </div>
          <p className="text-base font-semibold text-primary">Nenhuma justificativa</p>
          <p className="text-sm text-secondary mt-1.5 max-w-xs">Justificativas enviadas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pendingJusts.map(j => (
            <div key={j.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-elevated/20 hover:bg-elevated/30 transition-all duration-200 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-amber)]/10 flex items-center justify-center shrink-0">
                <FileText size="15" className="text-[var(--accent-amber)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-primary">{j.user?.name || "Colaborador"}</span>
                  {j.user?.department && <span className="text-[10px] text-muted hidden sm:inline">{j.user.department}</span>}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] uppercase tracking-wider">Pendente</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-secondary">{j.reason}</span>
                  <span className="text-[9px] text-muted">·</span>
                  <span className="text-[11px] text-muted">{fmtDate(j.startDate)} → {fmtDate(j.endDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); handleApprove(j.id) }} disabled={justLoading}
                  className="w-8 h-8 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center text-[var(--accent-green)] hover:bg-[var(--accent-green)]/20 transition-all disabled:opacity-50"
                ><CheckCircle size="14" /></button>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setSelJust(selJust?.id === j.id ? null : j); setRejectText("") }}
                    className="w-8 h-8 rounded-lg bg-[var(--accent-red)]/10 flex items-center justify-center text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20 transition-all"
                  ><XCircle size="14" /></button>
                  {selJust?.id === j.id && (
                    <div className="absolute right-0 top-full mt-1.5 z-10 w-72 max-w-[calc(100vw-2rem)] bg-surface rounded-xl shadow-modal border border-default/5 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <textarea value={rejectText} onChange={e => setRejectText(e.target.value)}
                        placeholder="Motivo da recusa..."
                        rows={2} className="w-full px-3 py-2 rounded-lg bg-input border border-input text-xs text-primary placeholder:text-muted/50 focus:outline-none focus:border-[var(--accent-primary)]/30 transition-all resize-none mb-2"
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelJust(null)} className="flex-1 h-8 rounded-lg text-[11px] font-medium text-muted hover:text-primary transition-all">Cancelar</button>
                        <button onClick={() => handleReject(j.id)} disabled={justLoading}
                          className="flex-1 h-8 rounded-lg bg-[var(--accent-red)] text-white text-[11px] font-medium hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                        >{justLoading ? <Loader2 size="11" className="animate-spin" /> : null} Recusar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted shrink-0 hidden sm:block">{fmtRel(j.createdAt)}</span>
              <ExternalLink size="13" className="text-muted opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0" />
            </div>
          ))}

          {justifications.filter(j => j.status !== "PENDING").length > 0 && (
            <details className="group mt-2">
              <summary className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-muted hover:text-primary transition-all duration-200 px-1 py-2">
                <ChevronDown size="14" className="group-open:rotate-180 transition-transform duration-200" />
                Histórico ({justifications.filter(j => j.status !== "PENDING").length})
              </summary>
              <div className="flex flex-col">
                {justifications.filter(j => j.status !== "PENDING").map((j, ji) => (
                  <div key={j.id} className="flex items-center gap-3 py-3 border-b border-default/5 last:border-b-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${j.status === "APPROVED" ? "bg-[var(--accent-green)]/8" : "bg-[var(--accent-red)]/8"}`}>
                      {j.status === "APPROVED"
                        ? <CheckCircle size="14" className="text-[var(--accent-green)]" />
                        : <XCircle size="14" className="text-[var(--accent-red)]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-primary">{j.user?.name || "Colaborador"}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${j.status === "APPROVED" ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]" : "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"}`}>
                          {j.status === "APPROVED" ? "Aprovado" : "Recusado"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{j.reason} · {fmtDate(j.startDate)} → {fmtDate(j.endDate)}</p>
                    </div>
                    <span className="text-[10px] text-muted shrink-0">{fmtRel(j.createdAt)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
