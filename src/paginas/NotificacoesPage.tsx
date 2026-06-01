import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Bell, AlertTriangle,
  CheckCheck, Info, ShieldCheck, Trash2,
  RefreshCw,
} from "lucide-react"
import { notifications as apiNotifs } from "../services/api"
import { PageHeader } from "../componentes/PageHeader"
import type { BackendNotification } from "../types"

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "WARNING", label: "Alertas" },
  { key: "INFO", label: "Informativos" },
  { key: "APPROVAL", label: "Aprovações" },
  { key: "SYSTEM", label: "Sistema" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

const ICON_MAP: Record<string, { icon: any; color: string; bg: string }> = {
  INFO: {
    icon: Info,
    color: "text-[#8AAEE0]",
    bg: "bg-[#8AAEE0]/8",
  },
  WARNING: {
    icon: AlertTriangle,
    color: "text-[#C49A6B]",
    bg: "bg-[#C49A6B]/8",
  },
  APPROVAL: {
    icon: ShieldCheck,
    color: "text-[#5B9B7A]",
    bg: "bg-[#5B9B7A]/8",
  },
  SYSTEM: {
    icon: Bell,
    color: "text-[#8AAEE0]",
    bg: "bg-[#8AAEE0]/8",
  },
}

const TYPE_LABEL: Record<string, string> = {
  INFO: "Informativo",
  WARNING: "Alerta",
  APPROVAL: "Aprovação",
  SYSTEM: "Sistema",
}

function formatRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return "Agora"
  if (mins < 60) return `Há ${mins}min`
  if (hours < 24) return `Há ${hours}h`
  if (days === 1) return "Ontem"
  if (days < 7) return `Há ${days} dias`
  return date.toLocaleDateString("pt-BR")
}

function formatGroupLabel(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return "Hoje"
  if (days === 1) return "Ontem"
  if (days < 7) return "Esta semana"
  if (days < 30) return "Este mês"
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

function getGroupKey(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return "hoje"
  if (days === 1) return "ontem"
  if (days < 7) return "semana"
  if (days < 30) return "mes"
  return "antigo"
}

const GROUP_ORDER = ["hoje", "ontem", "semana", "mes", "antigo"]

export function NotificacoesPage() {
  const [notifications, setNotifications] = useState<BackendNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todas")
  const [localRead, setLocalRead] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("chronos-notif-read")
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  const fetchNotifications = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true)
        await apiNotifs.refresh()
        setRefreshing(false)
      }
      const data = await apiNotifs.list()
      setNotifications(data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const triggerRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('notifications-refresh'))
  }, [])

  const handleMarkRead = useCallback(async (id: string) => {
    setLocalRead((prev) => new Set(prev).add(id))
    apiNotifs.markRead(id).catch(() => {})
    triggerRefresh()
  }, [triggerRefresh])

  const handleMarkAllRead = useCallback(async () => {
    const allIds = notifications.filter((n) => !n.read).map((n) => n.id)
    setLocalRead((prev) => {
      const next = new Set(prev)
      for (const id of allIds) next.add(id)
      return next
    })
    apiNotifs.markAllRead().catch(() => {})
    triggerRefresh()
  }, [notifications, triggerRefresh])

  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    apiNotifs.delete(id).catch(() => {})
    triggerRefresh()
  }, [triggerRefresh])

  const enhanced = useMemo(() => {
    return notifications.map((n) => ({
      ...n,
      read: n.read || localRead.has(n.id),
    }))
  }, [notifications, localRead])

  const filtered = useMemo(() => {
    if (activeFilter === "todas") return enhanced
    return enhanced.filter((n) => n.type === activeFilter)
  }, [enhanced, activeFilter])

  const groups = useMemo(() => {
    const map = new Map<string, BackendNotification[]>()
    for (const n of filtered) {
      const date = new Date(n.createdAt)
      const key = getGroupKey(date)
      const arr = map.get(key) ?? []
      arr.push(n)
      map.set(key, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
      .map(([key, items]) => ({
        key,
        label: formatGroupLabel(new Date(items[0].createdAt)),
        items,
      }))
  }, [filtered])

  const unreadCount = enhanced.filter((n) => !n.read).length
  const hasNotifs = notifications.length > 0
  const isEmpty = !loading && !hasNotifs

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Notificações"
        subtitle={
          hasNotifs
            ? `${notifications.length} notificação${notifications.length !== 1 ? "ões" : ""} no total`
            : "Fique por dentro dos avisos e lembretes importantes."
        }
        loading={loading}
        actions={
          <button
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-default/20 text-[11px] font-medium text-secondary hover:text-primary hover:bg-elevated/30 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw size={12} strokeWidth={2} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-md bg-elevated/50 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                activeFilter === f.key
                  ? "bg-[var(--accent-primary)] text-white"
                  : "text-muted hover:text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              <span className="text-[11px] font-medium text-[var(--accent-primary)]">
                {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-all duration-200"
            >
              <CheckCheck size={14} strokeWidth={2} />
              Marcar todas como lidas
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
            <Bell size={28} className="text-[var(--accent-primary)]" />
          </div>
          <p className="text-base font-semibold text-primary">Nenhuma notificação</p>
          <p className="text-sm text-secondary mt-1.5 max-w-xs">
            {activeFilter === "todas"
              ? "Você está em dia com todos os registros."
              : `Nenhuma notificação do tipo "${FILTERS.find((f) => f.key === activeFilter)?.label}".`}
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-surface animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-elevated/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-elevated/50" />
                <div className="h-3 w-72 rounded bg-elevated/30" />
              </div>
              <div className="h-3 w-12 rounded bg-elevated/30" />
            </div>
          ))}
        </div>
      )}

      {/* Groups */}
      {!loading && groups.length > 0 && (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {group.label}
                </span>
                <span className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] text-muted font-medium">
                  {group.items.length}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                  {group.items.map((n) => {
                    const iconInfo = ICON_MAP[n.type] ?? ICON_MAP.INFO
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`group relative flex items-start gap-4 p-4 rounded-xl transition-all duration-200 cursor-pointer
                          ${n.read
                            ? "hover:bg-elevated/20"
                            : "bg-surface hover:bg-elevated/30"
                          }
                          ${n.read ? "" : "border-l-2 border-[var(--accent-primary)]"}
                          hover:translate-x-0.5
                        `}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconInfo.bg} transition-all duration-200 group-hover:scale-105`}
                        >
                          <iconInfo.icon size={16} className={iconInfo.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className={`text-sm font-semibold ${n.read ? "text-secondary" : "text-primary"}`}>
                                  {n.title}
                                </h3>
                                {!n.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0 animate-pulse" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-[10px] font-medium whitespace-nowrap ${n.read ? "text-muted" : "text-[var(--accent-primary)]"}`}>
                                  {formatRelativeTime(n.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${iconInfo.bg} ${iconInfo.color}`}>
                                {TYPE_LABEL[n.type] ?? n.type}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }}
                          className="self-center opacity-0 group-hover:opacity-100 transition-all duration-200 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-muted hover:text-[#C96B6B] hover:bg-[#C96B6B]/10"
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}