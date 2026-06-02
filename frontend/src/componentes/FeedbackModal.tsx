import { CheckCircle2, Clock, XCircle } from "lucide-react"

interface DetailRow {
  label: string
  value: string
}

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  type: "success" | "pending" | "error"
  title: string
  message: string
  details?: DetailRow[]
  statusText?: string
  statusColor?: string
  buttonText?: string
  secondaryButton?: { text: string; onClick: () => void }
}

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    iconColor: "text-[#5B9B7A]",
  },
  pending: {
    icon: Clock,
    iconColor: "text-[#C49A6B]",
  },
  error: {
    icon: XCircle,
    iconColor: "text-[#C96B6B]",
  },
}

export function FeedbackModal({
  open, onClose, type, title, message, details,
  statusText, statusColor, buttonText, secondaryButton,
}: FeedbackModalProps) {
  if (!open) return null

  const cfg = TYPE_CONFIG[type]
  const Icon = cfg.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md mx-4 bg-surface border border-default/40 rounded-xl p-6 animate-in fade-in zoom-in duration-200"
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${type === "success" ? "bg-[#5B9B7A]/8" : type === "pending" ? "bg-[#C49A6B]/8" : "bg-[#C96B6B]/8"}`}>
            <Icon size={28} className={cfg.iconColor} />
          </div>

          <h2 className="text-lg font-bold text-primary tracking-tight">{title}</h2>
          <p className="text-sm text-secondary mt-2 leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {details && details.length > 0 && (
          <div className="mt-6 rounded-lg bg-elevated/50 p-4 flex flex-col gap-2">
            {details.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[11px] text-muted">{d.label}</span>
                <span className="text-xs font-semibold text-primary font-mono">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {statusText && (
          <div className="mt-5 flex items-center justify-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor || "var(--accent-hover)" }}
            />
            <span className="text-[11px] font-semibold" style={{ color: statusColor || "var(--accent-hover)" }}>
              {statusText}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-6">
          {secondaryButton && (
            <button
              onClick={secondaryButton.onClick}
              className="flex-1 h-11 rounded-lg bg-surface border border-default/50 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              {secondaryButton.text}
            </button>
          )}
          <button
            onClick={onClose}
            className={`${secondaryButton ? "flex-1" : "w-full"} h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200`}
          >
            {buttonText || "Fechar"}
          </button>
        </div>
      </div>
    </div>
  )
}
