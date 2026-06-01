import { useState } from "react"
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle, XCircle } from "lucide-react"
import { useTheme } from "../contexts/ThemeContext"
import { auth as apiAuth, setToken } from "../services/api"
import { toast } from "../componentes/Toast"

interface ResetPasswordPageProps {
  onReset: () => void
}

export function ResetPasswordPage({ onReset }: ResetPasswordPageProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const params = new URLSearchParams(window.location.search)
  const token = params.get("token")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (!token) {
    return (
      <div className={`h-screen ${isDark ? "bg-[#0B1120]" : "bg-white"} flex items-center justify-center`}>
        <div className={`w-full max-w-md mx-4 p-8 rounded-2xl ${isDark ? "bg-[#111827]" : "bg-[#F8FAFC]"} border border-default/30 text-center`}>
          <XCircle size={40} className="mx-auto mb-4 text-accent-red" />
          <h2 className={`text-lg font-bold ${isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"}`}>Link inválido</h2>
          <p className={`text-sm ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"} mt-1`}>Token de recuperação não encontrado na URL.</p>
        </div>
      </div>
    )
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!password) errs.password = "Informe uma nova senha"
    else if (password.length < 8) errs.password = "Mínimo 8 caracteres"
    else if (!/[A-Z]/.test(password)) errs.password = "Deve conter uma letra maiúscula"
    else if (!/\d/.test(password)) errs.password = "Deve conter um número"
    if (password !== confirm) errs.confirm = "Senhas não conferem"
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await apiAuth.updatePassword(token!, password)
      setToken(res.token)
      setStatus("success")
      setMessage(res.message || "Senha alterada com sucesso!")
      toast({ type: "success", title: "Senha alterada", message: "Sua senha foi atualizada." })
      setTimeout(() => onReset(), 2000)
    } catch (err: any) {
      setStatus("error")
      setMessage(err?.message || "Erro ao alterar senha.")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full h-11 px-4 rounded-lg text-sm outline-none transition-all duration-200 ${
    isDark
      ? "bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#8AAEE0]"
      : "bg-white text-[#1B2A41] placeholder-[#8A97AB] border border-[#D5DEEF] focus:border-[#8AAEE0] shadow-sm"
  }`
  const labelClass = `text-xs font-semibold uppercase tracking-wider ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"}`

  if (status === "success") {
    return (
      <div className={`h-screen ${isDark ? "bg-[#0B1120]" : "bg-white"} flex items-center justify-center`}>
        <div className={`w-full max-w-md mx-4 p-8 rounded-2xl ${isDark ? "bg-[#111827]" : "bg-[#F8FAFC]"} border border-default/30 text-center`}>
          <CheckCircle size={40} className="mx-auto mb-4 text-accent-green" />
          <h2 className={`text-lg font-bold ${isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"}`}>Senha alterada!</h2>
          <p className={`text-sm ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"} mt-1`}>{message}</p>
          <p className={`text-xs ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"} mt-4`}>Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen ${isDark ? "bg-[#0B1120]" : "bg-white"} flex items-center justify-center`}>
      <div className={`w-full max-w-md mx-4 p-8 rounded-2xl ${isDark ? "bg-[#111827]" : "bg-[#F8FAFC]"} border border-default/30`}>
        <h2 className={`text-xl font-bold tracking-tight mb-1 ${isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"}`}>Redefinir senha</h2>
        <p className={`text-sm mb-6 ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"}`}>Escolha uma nova senha para sua conta.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Nova senha</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })) }}
                placeholder="••••••••"
                className={`${inputClass} pr-11 ${fieldErrors.password ? "border-[#D94A4A]" : ""}`}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/50" : "text-[#8A97AB]"}`}>
                {showPwd ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
              </button>
            </div>
            {fieldErrors.password && <span className="text-xs text-[#D94A4A]">{fieldErrors.password}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Confirmar senha</label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setFieldErrors((p) => ({ ...p, confirm: "" })) }}
              placeholder="••••••••"
              className={`${inputClass} ${fieldErrors.confirm ? "border-[#D94A4A]" : ""}`}
              autoComplete="new-password"
            />
            {fieldErrors.confirm && <span className="text-xs text-[#D94A4A]">{fieldErrors.confirm}</span>}
          </div>

          {status === "error" && (
            <div className="rounded-xl bg-[#D94A4A]/10 border border-[#D94A4A]/30 p-3">
              <p className="text-xs text-[#D94A4A]">{message}</p>
            </div>
          )}

          <button type="submit" disabled={loading || !password || password !== confirm}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Alterando...</span>
            ) : (
              <><span>Alterar senha</span><ArrowRight size={16} strokeWidth={2} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
