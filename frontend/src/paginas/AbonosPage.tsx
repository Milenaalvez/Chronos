import { useState, useEffect } from "react"
import { Hand, ShieldCheck, Loader2 } from "lucide-react"
import { PageHeader } from "../componentes/PageHeader"
import { justifications as apiJust } from "../services/api"

function fmtDate(d: string): string {
  try { return new Date(d.substring(0, 10)).toLocaleDateString("pt-BR") } catch { return d }
}

export function AbonosPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJust.list()
      .then(data => setItems((data || []).filter((j: any) => j.status === "APPROVED")))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Abonos" subtitle="Períodos abonados por justificativas aprovadas" />
      <div className="px-6 pb-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 flex items-center justify-center mb-4">
              <Hand size={28} className="text-[var(--accent-primary)]" />
            </div>
            <p className="text-sm font-medium text-primary">Nenhum abono registrado</p>
            <p className="text-xs text-muted mt-1">Períodos justificados e aprovados aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((j: any) => (
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
    </div>
  )
}
