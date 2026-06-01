import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Clock, MapPin, Smartphone, Camera, KeyRound, User, Hash, Briefcase, Building, Loader2, X, ExternalLink, Wifi, Globe, Monitor, ShieldCheck } from "lucide-react"
import { timeRecords as apiRecords, pointRecords as apiPointRecords } from "../services/api"
import type { PointEvent } from "../types"

interface ReviewItem {
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

interface ReviewModalProps {
  record: ReviewItem | null
  onClose: () => void
  onRefresh: () => void
}

export function ReviewModal({ record, onClose, onRefresh }: ReviewModalProps) {
  const [pointEvents, setPointEvents] = useState<PointEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!record) return
    setLoadingEvents(true)
    const dateISO = record.date?.substring?.(0, 10) || record.date
    apiPointRecords.list(dateISO, true).then((events) => {
      setPointEvents(events)
    }).catch(() => {}).finally(() => setLoadingEvents(false))
  }, [record])

  if (!record) return null

  const formatDate = (d: string) => {
    try {
      return new Date(d.substring(0, 10)).toLocaleDateString("pt-BR")
    } catch { return d }
  }

  const maskCPF = (cpf?: string | null) => {
    if (!cpf) return "---"
    return `***.***.***-${cpf.slice(-2)}`
  }

  const getLocationFromEvents = () => {
    const ev = pointEvents.find(e => e.latitude)
    return ev || null
  }

  const getDeviceFromEvents = () => {
    const ev = pointEvents.find(e => e.deviceInfo)
    return ev?.deviceInfo as Record<string, string> | null || null
  }

  const getPhotoFromEvents = () => {
    const ev = pointEvents.find(e => e.hasPhoto && e.photoData)
    return ev?.photoData || null
  }

  const location = getLocationFromEvents()
  const device = getDeviceFromEvents()
  const photo = getPhotoFromEvents()

  const validations = [
    { label: "Senha confirmada", ok: pointEvents.some(e => e.passwordVerified) },
    { label: "Foto capturada", ok: pointEvents.some(e => e.hasPhoto) },
    { label: "Reconhecimento facial", ok: pointEvents.some(e => e.faceVerified === true), fail: pointEvents.some(e => e.faceVerified === false) },
    { label: "Localização obtida", ok: !!location },
    { label: "Dispositivo identificado", ok: !!device },
    { label: "Matrícula válida", ok: !!record.user?.registrationNumber },
  ]

  const handleAction = async (action: "approve" | "reject") => {
    setActionLoading(action)
    setActionError(null)
    try {
      if (action === "approve") {
        await apiRecords.approve(record.id, note || undefined)
      } else {
        await apiRecords.reject(record.id, note || undefined)
      }
      onRefresh()
      onClose()
    } catch (err: any) {
      setActionError(err?.message || "Erro ao processar")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-default/5">
            <div className="flex items-center gap-3">
              <ShieldCheck size="16" className="text-[var(--accent-primary)]" />
              <h2 className="text-sm font-bold text-primary">Analisar Registro</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/20 transition-all">
              <X size="14" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* ─── PHOTO ─── */}
            {loadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size="18" className="animate-spin text-muted" />
              </div>
            ) : photo ? (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Camera size="13" className="text-muted" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Foto capturada</span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/20 max-w-[320px] border border-default/5">
                  <img src={photo} alt="Foto do registro" className="w-full object-cover" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--accent-amber)]/8">
                <AlertTriangle size="14" className="text-[var(--accent-amber)] shrink-0" />
                <div>
                  <p className="text-xs font-medium text-[var(--accent-amber)]">Sem evidência fotográfica</p>
                  <p className="text-[10px] text-secondary mt-0.5">Nenhuma foto foi capturada neste registro.</p>
                </div>
              </div>
            )}

            {/* ─── COLLABORATOR DATA ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <User size="13" className="text-muted" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Dados do colaborador</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  {record.user?.avatar ? (
                    <img src={record.user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-elevated/30 flex items-center justify-center text-xs font-bold text-muted">
                      {record.user?.name?.[0] || "U"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">{record.user?.name || "---"}</p>
                  <p className="text-[11px] text-secondary">{record.user?.position || record.user?.role || "---"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Hash size="10" className="text-muted shrink-0" />
                  <span className="text-[11px] text-secondary font-mono">CHR{record.user?.registrationNumber || "---"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted font-mono">{maskCPF((record.user as any)?.cpf)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase size="10" className="text-muted shrink-0" />
                  <span className="text-[11px] text-secondary">{record.user?.position || "---"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building size="10" className="text-muted shrink-0" />
                  <span className="text-[11px] text-secondary">{record.user?.department || "---"}</span>
                </div>
              </div>
            </div>

            {/* ─── RECORD INFO ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Clock size="13" className="text-muted" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Informações do registro</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[9px] text-muted uppercase tracking-wider block">Tipo</span>
                  <span className="text-[13px] font-semibold text-primary">Jornada</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted uppercase tracking-wider block">Data</span>
                  <span className="text-[13px] font-semibold text-primary">{formatDate(record.date)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted uppercase tracking-wider block">Horário</span>
                  <span className="text-[13px] font-semibold text-primary font-mono">{record.clockIn}</span>
                </div>
              </div>
            </div>

            {/* ─── LOCATION ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <MapPin size="13" className="text-muted" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Localização</span>
                {location && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--accent-green)]">
                    <Wifi size="9" />
                    Verificada
                  </span>
                )}
              </div>
              {location ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-primary leading-snug">
                    {location.locationCity
                      ? `${location.locationAddress ? `${location.locationAddress} — ` : ""}${location.locationCity}/${location.locationState}`
                      : `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[9px] text-muted uppercase tracking-wider">Latitude</span>
                      <p className="text-[11px] font-mono text-primary">{location.latitude?.toFixed(6)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted uppercase tracking-wider">Longitude</span>
                      <p className="text-[11px] font-mono text-primary">{location.longitude?.toFixed(6)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted uppercase tracking-wider">Precisão</span>
                      <p className="text-[11px] font-mono text-primary">{location.locationAccuracy}m</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted">Localização não disponível para este registro.</p>
              )}
            </div>

            {/* ─── DEVICE ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Smartphone size="13" className="text-muted" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Dispositivo</span>
              </div>
              {device ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <span className="text-[9px] text-muted uppercase tracking-wider">Navegador</span>
                    <p className="text-[11px] font-mono text-primary">{device.browser || "---"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted uppercase tracking-wider">Sistema</span>
                    <p className="text-[11px] font-mono text-primary">{device.os || "---"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted uppercase tracking-wider">IP</span>
                    <p className="text-[11px] font-mono text-primary">{device.ip || "---"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted uppercase tracking-wider">Fuso</span>
                    <p className="text-[11px] font-mono text-primary">{device.timezone || "---"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted">Informações de dispositivo não disponíveis.</p>
              )}
            </div>

            {/* ─── VALIDATIONS ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <ShieldCheck size="13" className="text-muted" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Validações</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {validations.map((v) => (
                  <div key={v.label} className="flex items-center gap-2">
                    {v.ok ? (
                      <CheckCircle2 size="11" className="text-[var(--accent-green)] shrink-0" />
                    ) : (v as any).fail ? (
                      <XCircle size="11" className="text-[var(--accent-red)] shrink-0" />
                    ) : (
                      <XCircle size="11" className="text-[var(--accent-red)] shrink-0" />
                    )}
                    <span className={`text-[11px] ${v.ok ? "text-secondary" : (v as any).fail ? "text-[var(--accent-red)]" : "text-[var(--accent-red)]"}`}>{v.label}</span>
                    {(v.label === "Reconhecimento facial") && v.ok && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--accent-green)]">
                        <CheckCircle2 size="9" />
                        Identidade validada
                      </span>
                    )}
                    {(v.label === "Reconhecimento facial") && (v as any).fail && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--accent-red)]">
                        <XCircle size="9" />
                        Identidade não validada
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ─── NOTES ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Observações</span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Insira observações sobre a análise deste registro..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg bg-input border border-input text-[13px] text-primary placeholder:text-muted/50 focus:outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/15 transition-all resize-none"
              />
            </div>

            {actionError && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--accent-red)]/8 border border-[var(--accent-red)]/10">
                <AlertTriangle size="14" className="text-[var(--accent-red)] shrink-0" />
                <p className="text-xs font-medium text-[var(--accent-red)]">{actionError}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-default/5">
            <button
              onClick={onClose}
              className="h-11 px-4 rounded-lg text-xs font-semibold text-muted hover:text-primary hover:bg-elevated/20 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={actionLoading !== null}
              className="h-11 px-4 rounded-lg text-xs font-semibold bg-[var(--accent-red)]/10 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading === "reject" ? <Loader2 size="12" className="animate-spin" /> : <XCircle size="12" />}
              Rejeitar
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={actionLoading !== null}
              className="h-11 px-4 rounded-lg text-xs font-semibold bg-[var(--accent-green)]/10 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading === "approve" ? <Loader2 size="12" className="animate-spin" /> : <CheckCircle2 size="12" />}
              Aprovar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
