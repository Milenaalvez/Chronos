import { useState, useEffect } from "react"
import { ShieldCheck, Clock, AlertTriangle, CheckCircle, XCircle, Loader2, ExternalLink, Eye } from "lucide-react"
import { PageHeader } from "../componentes/PageHeader"
import { timeRecords as apiRecords } from "../services/api"
import { ReviewModal } from "../componentes/ReviewModal"

interface PendingReviewItem {
  id: string
  clockIn: string
  clockOut: string | null
  breakStart: string | null
  breakEnd: string | null
  date: string
  totalMinutes: number | null
  reviewStatus: string
  user: {
    id: string
    name: string
    email: string
    avatar: string | null
    role: string
    department: string | null
    position: string | null
    registrationNumber?: string | null
    cpf?: string | null
  }
}

function fmtMins(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}h${String(min).padStart(2, "0")}m`
}

export function EmAnalisePage() {
  const [records, setRecords] = useState<PendingReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selRecord, setSelRecord] = useState<PendingReviewItem | null>(null)

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const data = await apiRecords.pendingReviews()
      setRecords(data || [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Em Análise"
        subtitle="Registros de jornada aguardando validação"
      />

      {records.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-amber)]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
            <span className="text-[11px] font-medium text-[var(--accent-amber)]">{records.length} pendente{records.length !== 1 ? "s" : ""}</span>
          </div>
          <span className="text-[11px] text-muted">Registros aguardando aprovação</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-elevated/20 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
            <CheckCircle size="28" className="text-[var(--accent-green)]" />
          </div>
          <p className="text-base font-semibold text-primary">Nenhum registro pendente</p>
          <p className="text-sm text-secondary mt-1.5 max-w-xs">
            Todos os registros de jornada foram processados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map(r => {
            const fmtDate = r.date?.substring?.(0, 10)
              ? new Date(r.date.substring(0, 10)).toLocaleDateString("pt-BR")
              : r.date
            return (
              <div key={r.id} onClick={() => setSelRecord(r)}
                className="flex items-center gap-4 p-4 rounded-xl bg-elevated/20 hover:bg-elevated/30 transition-all duration-200 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--accent-amber)]/10 flex items-center justify-center shrink-0">
                  <Clock size="15" className="text-[var(--accent-amber)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-primary">{r.user?.name || "Colaborador"}</span>
                    {r.user?.department && (
                      <span className="text-[10px] text-muted hidden sm:inline">{r.user.department}</span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] uppercase tracking-wider">Pendente</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-secondary">{fmtDate}</span>
                    <span className="text-[9px] text-muted">·</span>
                    <span className="text-[11px] text-muted">{r.clockIn} → {r.clockOut || "---"}</span>
                    {r.totalMinutes != null && (
                      <>
                        <span className="text-[9px] text-muted">·</span>
                        <span className="text-[11px] text-muted">{fmtMins(r.totalMinutes)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="w-8 h-8 rounded-lg bg-elevated/30 flex items-center justify-center text-muted hover:text-primary transition-all opacity-0 group-hover:opacity-100">
                    <Eye size="14" />
                  </button>
                </div>
                <ExternalLink size="13" className="text-muted opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      <ReviewModal
        record={selRecord}
        onClose={() => setSelRecord(null)}
        onRefresh={fetchRecords}
      />
    </div>
  )
}
