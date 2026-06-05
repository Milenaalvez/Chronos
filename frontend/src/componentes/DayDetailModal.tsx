import { useState, useMemo } from "react"
import { X, Pencil, Clock, History, LogIn, Coffee, Undo2, LogOut, CheckCircle2, Loader2 } from "lucide-react"
import type { TimeRecord, FormData } from "../types"
import { formatMinutes, toMinutes } from "../types"

interface ActivityLog {
  action: "created" | "edited" | "exported" | "justified"
  timestamp: string
  user: string
  detail?: string
}

interface DayDetailModalProps {
  open: boolean
  onClose: () => void
  record: TimeRecord | null
  onEdit: (dataISO: string) => void
  onSave?: (data: FormData) => void
  activityLogs?: ActivityLog[]
}

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
const STD_DAY_MINS = 480

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(+y, +m - 1, +d)
  const weekday = WEEKDAY_NAMES[date.getDay()]
  return `${weekday}, ${d}/${m}/${y}`
}

function parseTime(t: string): number {
  if (!t || t === "---") return -1
  const [h, m] = t.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return -1
  return h * 60 + m
}

function computePreview(form: { entrada: string; saidaIntervalo: string; retornoIntervalo: string; saida: string }) {
  const entrada = parseTime(form.entrada)
  const si = parseTime(form.saidaIntervalo)
  const ri = parseTime(form.retornoIntervalo)
  const saida = parseTime(form.saida)
  if (entrada < 0) return null

  const hasLunch = si >= 0 && ri >= 0
  let totalMins = 0
  if (hasLunch) {
    totalMins = (saida >= 0 ? saida : 0) - entrada - (ri - si)
  } else if (saida >= 0) {
    totalMins = saida - entrada
  }

  const saldo = saida >= 0 ? totalMins - STD_DAY_MINS : 0
  return {
    totalMins: Math.max(totalMins, 0),
    saldoMins: saldo,
    isPartial: saida < 0,
    hasLunch,
  }
}

const ACTION_CONFIG: Record<ActivityLog["action"], { icon: any; color: string; label: string }> = {
  created: { icon: Pencil, color: "text-[var(--accent-primary)]", label: "Registrado" },
  edited: { icon: Pencil, color: "text-[var(--accent-hover)]", label: "Editado" },
  exported: { icon: History, color: "text-[#5B9B7A]", label: "Exportado" },
  justified: { icon: History, color: "text-[#5B9B7A]", label: "Justificado" },
}

export function DayDetailModal({ open, onClose, record, onEdit, onSave, activityLogs }: DayDetailModalProps) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<{ entrada: string; saidaIntervalo: string; retornoIntervalo: string; saida: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!open || !record) return null
  const rec = record

  const bancoDiaMins = Math.round((rec.totalHours - 8) * 60)
  const bancoDia = bancoDiaMins / 60
  const isMissing = rec.tipo === "Pendente"
  const isWeekend = rec.dataISO ? (new Date(rec.dataISO + "T12:00:00").getDay() === 0 || new Date(rec.dataISO + "T12:00:00").getDay() === 6) : false

  const preview = useMemo(() => {
    if (!editForm) return null
    return computePreview(editForm)
  }, [editForm])

  function startEditing() {
    const now = new Date()
    const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    setEditForm({
      entrada: rec.entrada !== "---" ? rec.entrada : nowStr,
      saidaIntervalo: rec.saidaIntervalo !== "---" ? rec.saidaIntervalo : "",
      retornoIntervalo: rec.retornoIntervalo !== "---" ? rec.retornoIntervalo : "",
      saida: rec.saida !== "---" ? rec.saida : "",
    })
    setEditing(true)
    setSaved(false)
  }

  function cancelEditing() {
    setEditing(false)
    setEditForm(null)
    setSaved(false)
  }

  async function handleSave() {
    if (!editForm || !onSave) return
    setSaving(true)
    onSave({
      data: rec.dataISO,
      entrada: editForm.entrada,
      saidaIntervalo: editForm.saidaIntervalo || undefined,
      retornoIntervalo: editForm.retornoIntervalo || undefined,
      saida: editForm.saida || undefined,
    })
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setEditForm(null)
  }

  function handleFieldChange(field: string, value: string) {
    setEditForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      if (field === "saidaIntervalo" && value && !next.retornoIntervalo) {
        const [h, m] = value.split(":").map(Number)
        if (!isNaN(h) && !isNaN(m)) {
          const ri = new Date()
          ri.setHours(h + 1, m)
          next.retornoIntervalo = `${String(ri.getHours()).padStart(2, "0")}:${String(ri.getMinutes()).padStart(2, "0")}`
        }
      }
      return next
    })
  }

  const fields: { icon: any; label: string; key: string; color: string }[] = [
    { icon: LogIn, label: "Entrada", key: "entrada", color: "text-green-400" },
    { icon: Coffee, label: "Intervalo", key: "saidaIntervalo", color: "text-yellow-400" },
    { icon: Undo2, label: "Retorno", key: "retornoIntervalo", color: "text-blue-400" },
    { icon: LogOut, label: "Saída", key: "saida", color: "text-red-400" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-default/10 shadow-modal rounded-xl p-5 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col gap-1 mb-6">
          <h2 className="text-lg font-bold text-primary tracking-tight">
            {formatDateBR(rec.dataISO)}
          </h2>
          <span className={`text-xs font-medium ${isMissing ? "text-[#C96B6B]" : isWeekend ? "text-[var(--accent-hover)]" : "text-[#5B9B7A]"}`}>
            {isMissing ? "Não registrado" : isWeekend ? "Fim de semana" : "Registrado"}
          </span>
        </div>

        {isMissing ? (
          <div className="flex flex-col gap-4">
            <div className="px-4 py-3 rounded-lg bg-elevated/50">
              <p className="text-sm text-secondary leading-relaxed">
                Nenhum registro encontrado para este dia. Clique no botão abaixo para registrar a jornada.
              </p>
            </div>
            <button
              onClick={() => { onClose(); onEdit(rec.dataISO) }}
              className="flex items-center justify-center gap-2 h-11 w-full rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
            >
              <Pencil size={14} strokeWidth={2} />
              Registrar Jornada
            </button>
          </div>
        ) : isWeekend ? (
          <div className="px-4 py-3 rounded-lg bg-elevated/50">
            <p className="text-sm text-muted leading-relaxed">Fim de semana — não há registro de jornada.</p>
          </div>
        ) : editing && editForm ? (
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              {fields.map((f) => {
                const val = editForm[f.key as keyof typeof editForm]
                const locked = f.key === "entrada"
                return (
                  <div key={f.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${locked ? "bg-elevated/40" : "bg-blue-500/5 border border-blue-500/20"}`}>
                    <div className={`w-7 h-7 rounded flex items-center justify-center ${f.color.replace("text-", "bg-")}/10`}>
                      <f.icon size={12} className={f.color} />
                    </div>
                    <span className="text-xs font-semibold text-secondary flex-1">{f.label}</span>
                    {locked ? (
                      <span className="text-sm font-mono font-bold text-primary">{val}</span>
                    ) : (
                      <input
                        type="time"
                        value={val || ""}
                        onChange={(e) => handleFieldChange(f.key, e.target.value)}
                        className="w-28 h-9 px-2 rounded-lg bg-surface border border-blue-500/30 text-sm font-mono font-bold text-primary outline-none focus:border-blue-400 transition-all"
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {preview && (
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg px-3 py-2 ${preview.isPartial ? "bg-blue-500/8" : "bg-elevated/50"}`}>
                  <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Total</span>
                  <span className="text-sm font-bold font-mono text-primary block mt-0.5">
                    {preview.isPartial ? "---" : formatMinutes(preview.totalMins)}
                  </span>
                  {preview.isPartial && <span className="text-[9px] text-blue-400 font-medium">em andamento</span>}
                </div>
                <div className={`rounded-lg px-3 py-2 ${preview.isPartial ? "bg-blue-500/8" : preview.saldoMins >= 0 ? "bg-green-500/8" : "bg-red-500/8"}`}>
                  <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Banco</span>
                  <span className={`text-sm font-bold font-mono block mt-0.5 ${preview.isPartial ? "text-blue-400" : preview.saldoMins >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {preview.isPartial ? "---" : `${preview.saldoMins >= 0 ? "+" : ""}${formatMinutes(Math.abs(preview.saldoMins))}`}
                  </span>
                  {preview.isPartial && <span className="text-[9px] text-blue-400 font-medium">finalize o dia</span>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={cancelEditing}
                className="flex-1 h-10 rounded-lg bg-surface border border-default/20 text-xs font-semibold text-secondary hover:text-primary transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-10 rounded-lg bg-blue-500 text-xs font-semibold text-white hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : saved ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6">
            <CheckCircle2 size={32} className="text-green-400" />
            <span className="text-sm font-semibold text-primary">Registro salvo!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-elevated/50 divide-y divide-default/20">
              {fields.map((f, i) => {
                const val = rec[f.key as keyof TimeRecord] as string
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <f.icon size={13} className={`${f.color} shrink-0`} />
                      <span className="text-sm text-secondary">{f.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary font-mono">{val}</span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-elevated/50">
                <span className="text-[11px] text-muted font-medium">Total de horas</span>
                <span className="text-base font-bold text-primary font-mono">{rec.total}</span>
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-elevated/50">
                <span className="text-[11px] text-muted font-medium">Banco do dia</span>
                <span className={`text-base font-bold font-mono ${bancoDia >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
                  {bancoDia >= 0 ? "+" : ""}{formatMinutes(Math.round(Math.abs(bancoDia) * 60))}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {onSave && (
                <button
                  onClick={startEditing}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg bg-surface border border-default/20 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
                >
                  <Pencil size={14} strokeWidth={2} />
                  Editar
                </button>
              )}
              <button
                onClick={() => { onClose(); onEdit(rec.dataISO) }}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
              >
                <Clock size={14} strokeWidth={2} />
                Registrar Ponto
              </button>
            </div>

            {activityLogs && activityLogs.length > 0 && (
              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <History size={12} className="text-muted" strokeWidth={2} />
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Histórico de atividades</span>
                </div>
                <div className="rounded-lg bg-elevated/50 divide-y divide-default/20">
                  {activityLogs.map((log, i) => {
                    const cfg = ACTION_CONFIG[log.action]
                    const Icon = cfg.icon
                    return (
                      <div key={i} className="flex items-start gap-2.5 px-3.5 py-2">
                        <Icon size={11} className={`${cfg.color} shrink-0 mt-0.5`} strokeWidth={2.5} />
                        <div className="flex flex-col gap-px min-w-0">
                          <span className="text-xs text-primary font-medium">{cfg.label} por {log.user}</span>
                          <span className="text-[10px] text-muted">{log.timestamp}{log.detail ? ` — ${log.detail}` : ""}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}