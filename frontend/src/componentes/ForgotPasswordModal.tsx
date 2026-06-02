import { useState } from "react"
import { Mail, ArrowLeft, Loader2, Smartphone, KeyRound } from "lucide-react"
import { supabase } from "../services/supabase"
import { auth, setToken } from "../services/api"
import { toast } from "./Toast"
import { EmailCountdown } from "./EmailCountdown"

interface Props {
  onClose: () => void
}

type Tab = "email" | "sms"
type Step = "input" | "sent" | "otp" | "reset"

export function ForgotPasswordModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("email")
  const [step, setStep] = useState<Step>("input")

  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  function handleExpired() {
    toast({ type: "warning", title: "Tempo expirado", message: "O prazo para confirmar o email expirou. Tente novamente." })
    onClose()
  }

  function handleCancelSend() {
    setStep("input")
    toast({ type: "info", title: "Cancelado", message: "Envio cancelado." })
  }

  async function handleSendEmail() {
    if (!email.includes("@")) return
    setLoading(true)
    try {
      await auth.forgotPassword(email)
      setStep("sent")
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Email não encontrado" })
    } finally { setLoading(false) }
  }

  async function handleSendSms() {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 10) {
      toast({ type: "error", title: "Erro", message: "Telefone inválido" })
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+55${digits}`,
      })
      if (error) throw new Error(error.message)
      setStep("otp")
      toast({ type: "info", title: "SMS enviado", message: "Digite o código recebido." })
    } catch (err: any) {
      toast({ type: "info", title: "SMS", message: "Recuperação por SMS está em desenvolvimento. Use a aba Email." })
    } finally { setLoading(false) }
  }

  async function handleVerifyOtp() {
    if (otp.length < 4) return
    setLoading(true)
    try {
      const digits = phone.replace(/\D/g, "")
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+55${digits}`,
        token: otp,
        type: 'sms',
      })
      if (error) throw new Error(error.message)
      if (data.session) {
        setStep("reset")
      }
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Código inválido" })
    } finally { setLoading(false) }
  }

  async function handleResetPassword() {
    if (password.length < 8 || password !== confirm) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)

      const res = await auth.updatePassword(session.access_token, password)
      setToken(res.token)
      toast({ type: "success", title: "Senha redefinida", message: "Sua senha foi alterada com sucesso." })
      onClose()
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Erro ao redefinir senha" })
    } finally { setLoading(false) }
  }

  const tabClass = (t: Tab) =>
    `flex-1 py-3 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
      tab === t
        ? "bg-[#1D8FF8] text-white"
        : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]"
    }`

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-6 lg:px-12">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-2xl p-8 bg-[#0B1120] border border-[#1E293B] animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC] transition-all">
          <ArrowLeft size={16} strokeWidth={2} />
        </button>

        {step === "input" && (
          <>
            <div className="flex gap-2 mb-6 bg-[#111827] rounded-xl p-1">
              <button onClick={() => setTab("email")} className={tabClass("email")}>
                <Mail size={14} className="inline mr-1.5" /> Email
              </button>
              <button onClick={() => setTab("sms")} className={tabClass("sms")}>
                <Smartphone size={14} className="inline mr-1.5" /> SMS
              </button>
            </div>

            {tab === "email" ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight mb-1">Recuperar por email</h2>
                  <p className="text-sm text-[#94A3B8]">Você receberá um link para redefinir sua senha.</p>
                </div>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#628ECB]" />
                  </div>
                  <button onClick={handleSendEmail} disabled={!email.includes("@") || loading}
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Enviar link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight mb-1">Recuperar por SMS</h2>
                  <p className="text-sm text-[#94A3B8]">Você receberá um código no seu celular.</p>
                </div>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Telefone</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#628ECB]" />
                  </div>
                  <button onClick={handleSendSms} disabled={phone.replace(/\D/g, "").length < 10 || loading}
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Enviar código"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === "sent" && (
          <EmailCountdown
            email={email}
            duration={30}
            onExpired={handleExpired}
            onCancel={handleCancelSend}
          />
        )}

        {step === "otp" && (
          <>
            <div className="mb-6">
              <div className="w-11 h-11 rounded-xl bg-[#111827] flex items-center justify-center mb-4">
                <Smartphone size={18} strokeWidth={1.5} className="text-[#628ECB]" />
              </div>
              <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight mb-1">Código SMS</h2>
              <p className="text-sm text-[#94A3B8]">Digite o código enviado para seu celular.</p>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Código</label>
                <input type="text" inputMode="numeric" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#628ECB] text-center text-2xl tracking-[0.3em] font-mono" />
              </div>
              <button onClick={handleVerifyOtp} disabled={otp.length < 4 || loading}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><KeyRound size={16} strokeWidth={2} /> Verificar</>}
              </button>
            </div>
          </>
        )}

        {step === "reset" && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight mb-1">Nova senha</h2>
              <p className="text-sm text-[#94A3B8]">Crie uma nova senha para sua conta.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Nova senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#628ECB]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Confirmar senha</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••"
                  className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#628ECB]" />
              </div>
              <button onClick={handleResetPassword} disabled={password.length < 8 || password !== confirm || loading}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Redefinir senha"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
