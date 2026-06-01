import { useState } from "react"
import { Mail, Loader2, RefreshCw, ArrowRight, X } from "lucide-react"
import { useTheme } from "../contexts/ThemeContext"
import { auth as apiAuth, setToken } from "../services/api"
import { toast } from "../componentes/Toast"
import { EmailCountdown } from "../componentes/EmailCountdown"

interface VerificationRequiredPageProps {
  user: { email: string; name: string }
  onVerified: (userData: any) => void
  onBackToLogin?: () => void
}

export function VerificationRequiredPage({ user, onVerified, onBackToLogin }: VerificationRequiredPageProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [code, setCode] = useState("")
  const [codeVerifying, setCodeVerifying] = useState(false)
  const [countdownEmail, setCountdownEmail] = useState<string | null>(null)

  function handleCountdownExpired() {
    setCountdownEmail(null)
    toast({ type: "warning", title: "Tempo expirado", message: "O prazo para verificar o email expirou. Reenvie se necessário." })
  }

  async function handleResend() {
    setSending(true)
    try {
      await apiAuth.sendVerification(user.email)
      setCountdownEmail(user.email)
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Erro ao reenviar email" })
    } finally {
      setSending(false)
    }
  }

  async function handleCheckVerified() {
    setChecking(true)
    try {
      const u = await apiAuth.me()
      if (u.emailVerified) {
        toast({ type: "success", title: "Email verificado!", message: "Redirecionando..." })
        onVerified(u)
      } else {
        toast({ type: "info", title: "Ainda não verificado", message: "Clique no link enviado para seu email." })
      }
    } catch {
      toast({ type: "error", title: "Erro", message: "Erro ao verificar status" })
    } finally {
      setChecking(false)
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return
    setCodeVerifying(true)
    try {
      const res = await apiAuth.verifyEmail(code.trim())
      setToken(res.token)
      toast({ type: "success", title: "Email verificado!", message: res.message })
      onVerified(res.user)
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Código inválido ou expirado" })
    } finally {
      setCodeVerifying(false)
    }
  }

  const bg = isDark ? "bg-[#0B1120]" : "bg-[#F8FAFC]"
  const cardBg = isDark ? "bg-[#111827]" : "bg-white"
  const textColor = isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"
  const mutedColor = isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"
  const inputBg = isDark ? "bg-[#0B1120] border-[#1E293B]" : "bg-[#F8FAFC] border-[#D5DEEF]"
  const accent = "text-[#1D8FF8]"

  if (countdownEmail) {
    return (
      <div className={`h-screen ${bg} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md p-10 rounded-2xl ${cardBg} border border-default/30 shadow-lg relative`}>
        {onBackToLogin && (
          <button
            onClick={onBackToLogin}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC] transition-all"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
        <EmailCountdown
            email={countdownEmail}
            duration={30}
            onExpired={handleCountdownExpired}
            onCancel={() => { setCountdownEmail(null); toast({ type: "info", title: "Cancelado", message: "Reenvio cancelado." }) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen ${bg} flex items-center justify-center p-6`}>
      <div className={`w-full max-w-md p-10 rounded-2xl ${cardBg} border border-default/30 shadow-lg relative`}>
        {onBackToLogin && (
          <button
            onClick={onBackToLogin}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC] transition-all"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isDark ? "bg-[#1D8FF8]/10" : "bg-[#1D8FF8]/8"}`}>
          <Mail size={28} className={accent} />
        </div>

        <h1 className={`text-xl font-bold text-center ${textColor}`}>Verifique seu email</h1>
        <p className={`text-sm text-center mt-2 ${mutedColor} leading-relaxed`}>
          Enviamos um link de verificação para <strong className={textColor}>{user.email}</strong>.
        </p>
        <p className={`text-xs text-center mt-1 ${mutedColor}`}>
          Clique no link no email para ativar sua conta.
        </p>

        <div className="flex flex-col gap-3 mt-8">
          <button
            onClick={handleResend}
            disabled={sending}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#1D8FF8] text-sm font-semibold text-white hover:bg-[#0B72D6] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {sending ? (
              <><Loader2 size={16} className="animate-spin" /> Enviando...</>
            ) : (
              <><Mail size={16} /> Reenviar email</>
            )}
          </button>

          <button
            onClick={handleCheckVerified}
            disabled={checking}
            className={`flex items-center justify-center gap-2 w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? "bg-transparent border border-[#1E293B] text-[#F8FAFC] hover:bg-[#0B1120]"
                : "bg-white border border-[#D5DEEF] text-[#1B2A41] hover:bg-[#F8FAFC]"
            }`}
          >
            {checking ? (
              <><Loader2 size={16} className="animate-spin" /> Verificando...</>
            ) : (
              <><RefreshCw size={16} /> Já verifiquei — atualizar</>
            )}
          </button>
        </div>

        <div className={`flex items-center gap-4 my-8`}>
          <div className={`flex-1 h-px ${isDark ? "bg-[#1E293B]" : "bg-[#D5DEEF]"}`} />
          <span className={`text-xs font-medium ${mutedColor}`}>ou</span>
          <div className={`flex-1 h-px ${isDark ? "bg-[#1E293B]" : "bg-[#D5DEEF]"}`} />
        </div>

        <div className="flex flex-col gap-2">
          <label className={`text-xs font-semibold uppercase tracking-wider ${mutedColor}`}>Código de verificação</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleVerifyCode() }}
              placeholder="Cole o código do email"
              className={`flex-1 h-11 px-4 rounded-lg text-sm outline-none transition-all duration-200 ${inputBg} ${textColor} placeholder-[${isDark ? "#94A3B8/50" : "#8A97AB"}] focus:border-[#1D8FF8]`}
            />
            <button
              onClick={handleVerifyCode}
              disabled={!code.trim() || codeVerifying}
              className="flex items-center justify-center gap-1.5 h-11 px-5 rounded-lg bg-[#1D8FF8] text-sm font-semibold text-white hover:bg-[#0B72D6] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shrink-0"
            >
              {codeVerifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <><ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
