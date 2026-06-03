import { useState, useEffect } from "react"
import { Calendar, Hand, ShieldCheck, Loader2 } from "lucide-react"
import { Calendario } from "../componentes/Calendario"
import type { TimeRecord, Justificacao, FormData, PageAction } from "../types"
import { justifications as apiJust } from "../services/api"

interface CalendarioPageProps {
  records: TimeRecord[]
  allRecords: TimeRecord[]
  onEdit: (dataISO: string) => void
  onSave: (fd: FormData) => void
  justificacoes: Record<string, Justificacao>
  onJustificar: (data: Justificacao) => void
  pageAction?: PageAction | null
  onClearAction?: () => void
}

const tabs = [
  { key: "calendario", label: "Calendário", icon: Calendar },
  { key: "abonos", label: "Abonos", icon: Hand },
] as const

function fmtDate(d: string): string {
  try { return new Date(d.substring(0, 10)).toLocaleDateString("pt-BR") } catch { return d }
}

export function CalendarioPage({ records, allRecords, onEdit, onSave, justificacoes, onJustificar, pageAction, onClearAction }: CalendarioPageProps) {
  const [activeTab, setActiveTab] = useState<"calendario" | "abonos">("calendario")
  const [abonos, setAbonos] = useState<any[]>([])
  const [abonosLoading, setAbonosLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== "abonos") return
    setAbonosLoading(true)
    apiJust.list()
      .then(data => setAbonos((data || []).filter((j: any) => j.status === "APPROVED" || j.status === "aprovado")))
      .catch(() => setAbonos([]))
      .finally(() => setAbonosLoading(false))
  }, [activeTab])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-20 bg-[var(--bg-app)] border-b border-default/20 px-6">
        <div className="flex items-center gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 ${
                activeTab === t.key
                  ? "text-blue-400 border-blue-500"
                  : "text-muted border-transparent hover:text-secondary"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "calendario" && (
        <Calendario
          records={records}
          allRecords={allRecords}
          onEdit={onEdit}
          onSave={onSave}
          justificacoes={justificacoes}
          onJustificar={onJustificar}
          pageAction={pageAction}
          onClearAction={onClearAction}
        />
      )}

      {activeTab === "abonos" && (
        <div className="p-6">
          {abonosLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-muted" />
            </div>
          ) : abonos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Hand size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-primary">Nenhum abono registrado</p>
              <p className="text-xs text-muted mt-1">Períodos justificados e aprovados aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {abonos.map((j: any) => (
                <div key={j.id} className="rounded-xl bg-surface border border-default/20 p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">{j.user?.name || "—"}</p>
                    <p className="text-xs text-muted mt-0.5">{j.reason}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-secondary">
                        {fmtDate(j.startDate)} — {fmtDate(j.endDate)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
