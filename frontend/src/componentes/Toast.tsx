import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message: string
}

let toastId = 0
let addToastFn: ((t: Omit<ToastData, "id">) => void) | null = null

export function toast(data: Omit<ToastData, "id">) {
  addToastFn?.(data)
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: { bg: "bg-[#5B9B7A]/10 border-[#5B9B7A]/30", icon: "text-[#5B9B7A]" },
  error: { bg: "bg-[#D94A4A]/10 border-[#D94A4A]/30", icon: "text-[#D94A4A]" },
  warning: { bg: "bg-[#C49A6B]/10 border-[#C49A6B]/30", icon: "text-[#C49A6B]" },
  info: { bg: "bg-[#628ECB]/10 border-[#628ECB]/30", icon: "text-[#628ECB]" },
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    addToastFn = (t) => {
      const id = `toast_${++toastId}`
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id))
      }, 5000)
    }
    return () => { addToastFn = null }
  }, [])

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type]
        const c = colors[t.type]
        return (
          <div
            key={t.id}
            className={`pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${c.bg} border rounded-xl p-4 flex items-start gap-3 shadow-lg backdrop-blur-sm`}
          >
            <Icon size={20} className={`shrink-0 mt-0.5 ${c.icon}`} strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F8FAFC]">{t.title}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">{t.message}</p>
            </div>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 text-[#94A3B8]/50 hover:text-[#F8FAFC] transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
