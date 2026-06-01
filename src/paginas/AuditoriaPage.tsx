import { useState, useEffect } from "react"
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, User, Loader2, ShieldCheck } from "lucide-react"
import { PageHeader } from "../componentes/PageHeader"
import { team as apiTeam } from "../services/api"

interface ActivityItem {
  id: string
  action: string
  description: string | null
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  timestamp: string
  userId: string
  targetUserId: string | null
  user: { id: string; name: string; avatar: string | null; role: string }
  targetUser: { id: string; name: string; avatar: string | null } | null
}

function actIcon(action: string): { icon: any; color: string } {
  if (action.includes("APPROVE") || action.includes("APPROVED")) return { icon: CheckCircle, color: "text-[var(--accent-green)]" }
  if (action.includes("REJECT") || action.includes("REJECTED")) return { icon: XCircle, color: "text-[var(--accent-red)]" }
  if (action.includes("CREATE") || action.includes("REGISTER")) return { icon: Activity, color: "text-[var(--accent-primary)]" }
  if (action.includes("UPDATE") || action.includes("EDIT")) return { icon: Activity, color: "text-[var(--accent-amber)]" }
  return { icon: Activity, color: "text-muted" }
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

export function AuditoriaPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiTeam.activityLogs().then((data) => {
      setActivities(data || [])
    }).catch(() => {
      setActivities([])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Auditoria"
        subtitle="Registro de atividades e ações administrativas"
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-elevated/20 animate-pulse rounded-xl" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
            <Activity size="28" className="text-muted" />
          </div>
          <p className="text-base font-semibold text-primary">Nenhuma atividade</p>
          <p className="text-sm text-secondary mt-1.5 max-w-xs">Ações administrativas aparecerão aqui em tempo real.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {activities.map((a) => {
            const ai = actIcon(a.action)
            const AIcon = ai.icon
            return (
              <div key={a.id} className="relative flex items-start gap-3 py-3 border-b border-default/5 last:border-b-0">
                <div className="w-9 h-9 rounded-lg bg-elevated/30 flex items-center justify-center shrink-0">
                  <AIcon size="14" className={ai.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">{a.user?.name || "Sistema"}</span>
                    <span className="text-[10px] text-muted">{a.action.replace(/_/g, " ").toLowerCase()}</span>
                  </div>
                  {a.description && (
                    <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">{a.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {a.targetUser && <span className="text-[10px] text-[var(--accent-purple)] font-medium">{a.targetUser.name}</span>}
                    <span className="text-[9px] text-muted">{fmtRel(a.timestamp)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
