import { X, Pencil, Clock, History } from "lucide-react"
import type { TimeRecord } from "../types"
import { formatMinutes } from "../types"
import { computeDayBalanceMins } from "../services/workHoursEngine"

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
  activityLogs?: ActivityLog[]
}

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(+y, +m - 1, +d)
  const weekday = WEEKDAY_NAMES[date.getDay()]
  return `${weekday}, ${d}/${m}/${y}`
}

const ACTION_CONFIG: Record<ActivityLog["action"], { icon: any; color: string; label: string }> = {
  created: { icon: Pencil, color: "text-[var(--accent-primary)]", label: "Registrado" },
  edited: { icon: Pencil, color: "text-[var(--accent-hover)]", label: "Editado" },
  exported: { icon: History, color: "text-[#5B9B7A]", label: "Exportado" },
  justified: { icon: History, color: "text-[#5B9B7A]", label: "Justificado" },
}

export function DayDetailModal({ open, onClose, record, onEdit, activityLogs }: DayDetailModalProps) {
  if (!open || !record) return null

  const bancoDiaMins = computeDayBalanceMins(record)
  const bancoDia = bancoDiaMins / 60
  const isMissing = record.tipo === "Pendente"
  const isWeekend = record.dataISO ? (new Date(record.dataISO + "T12:00:00").getDay() === 0 || new Date(record.dataISO + "T12:00:00").getDay() === 6) : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-default/40 rounded-xl p-5 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col gap-1 mb-6">
          <h2 className="text-lg font-bold text-primary tracking-tight">
            {formatDateBR(record.dataISO)}
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
              onClick={() => { onClose(); onEdit(record.dataISO) }}
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
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-elevated/50 divide-y divide-default/20">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Clock size={13} className="text-[var(--accent-hover)] shrink-0" />
                  <span className="text-sm text-secondary">Entrada</span>
                </div>
                <span className="text-sm font-semibold text-primary font-mono">{record.entrada}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Clock size={13} className="text-[#C96B6B] shrink-0" />
                  <span className="text-sm text-secondary">Saída</span>
                </div>
                <span className="text-sm font-semibold text-primary font-mono">{record.saida}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-elevated/50">
                <span className="text-[11px] text-muted font-medium">Total de horas</span>
                <span className="text-base font-bold text-primary font-mono">{record.total}</span>
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-elevated/50">
                <span className="text-[11px] text-muted font-medium">Banco do dia</span>
                <span className={`text-base font-bold font-mono ${bancoDia >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
                  {bancoDia >= 0 ? "+" : ""}{formatMinutes(Math.round(Math.abs(bancoDia) * 60))}
                </span>
              </div>
            </div>

            <button
              onClick={() => { onClose(); onEdit(record.dataISO) }}
              className="flex items-center justify-center gap-2 h-11 w-full rounded-lg bg-surface border border-default/50 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <Pencil size={14} strokeWidth={2} />
              Editar Registro
            </button>

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
