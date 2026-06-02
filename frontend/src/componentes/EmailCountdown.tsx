import { useState, useEffect, useRef } from "react"
import { Clock, Loader2 } from "lucide-react"

interface EmailCountdownProps {
  email: string
  duration?: number
  onExpired: () => void
  onCancel?: () => void
}

export function EmailCountdown({ email, duration = 30, onExpired, onCancel }: EmailCountdownProps) {
  const [remaining, setRemaining] = useState(duration)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true
        onExpired()
      }
      return
    }
    const timer = setInterval(() => {
      setRemaining((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [remaining, onExpired])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  const pct = ((duration - remaining) / duration) * 100

  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-14 h-14 rounded-full bg-[#111827] flex items-center justify-center mb-4 relative">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="#1E293B" strokeWidth="3" />
          <circle
            cx="28" cy="28" r="24" fill="none" stroke="#1D8FF8" strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 24}`}
            strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <Clock size={20} strokeWidth={1.5} className="text-[#1D8FF8]" />
      </div>

      <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight mb-1">Email enviado!</h2>
      <p className="text-sm text-[#94A3B8] leading-relaxed">
        Enviamos um link de recuperação para<br />
        <span className="font-medium text-[#B1C9EF]">{email}</span>
      </p>
      <p className="text-xs text-[#64748B] mt-3">Verifique sua caixa de entrada e spam.</p>

      <div className="mt-5 flex items-center gap-2 bg-[#0B1120] border border-[#1E293B] rounded-xl px-5 py-3">
        <Loader2 size={14} className="text-[#1D8FF8] animate-spin" />
        <span className="text-sm text-[#94A3B8]">
          Aguardando confirmação...
        </span>
      </div>

      <div className="mt-4 text-center">
        <span className="text-2xl font-mono font-bold text-[#F8FAFC] tracking-wider">{display}</span>
        <p className="text-xs text-[#64748B] mt-1">Tempo restante</p>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors underline underline-offset-2"
        >
          Cancelar
        </button>
      )}
    </div>
  )
}
