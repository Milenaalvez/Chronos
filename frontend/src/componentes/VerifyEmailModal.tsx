import { useState } from "react"
import { Mail, ArrowLeft, Loader2, CheckCircle, ExternalLink } from "lucide-react"
import { supabase } from "../services/supabase"
import { toast } from "./Toast"

interface Props {
  email: string
  onVerified: (userData?: any) => void
  onBack: () => void
}

export function VerifyEmailModal({ email, onVerified: _onVerified, onBack }: Props) {
  const [sending, setSending] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleResend() {
    setSending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}?auth_callback=verification`,
        },
      })
      if (error) throw new Error(error.message)
      setResent(true)
      toast({ type: "info", title: "Email reenviado", message: "Verifique sua caixa de entrada e spam." })
      setTimeout(() => setResent(false), 5000)
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Erro ao reenviar email" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl p-8 bg-[#0B1120] border border-[#1E293B] animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC] transition-all"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col items-center text-center mb-6 mt-2">
          <div className="w-14 h-14 rounded-full bg-[#111827] flex items-center justify-center mb-4">
            <Mail size={24} strokeWidth={1.5} className="text-[#628ECB]" />
          </div>
          <h2 className="text-xl font-bold text-[#F8FAFC] tracking-tight mb-1">Verifique seu email</h2>
          <p className="text-sm text-[#94A3B8] max-w-xs leading-relaxed">
            Enviamos um link de verificação para<br />
            <span className="font-medium text-[#B1C9EF]">{email}</span>
          </p>
          <p className="text-xs text-[#64748B] mt-3 leading-relaxed">
            Clique no link enviado para ativar sua conta.<br />
            Se não encontrar, verifique a caixa de spam.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 justify-center text-xs text-[#64748B]">
            <ExternalLink size={12} strokeWidth={1.5} />
            O link é válido por tempo limitado
          </div>

          <button
            onClick={handleResend}
            disabled={sending}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-[#1E293B] bg-transparent text-sm font-medium text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {sending ? (
              <><Loader2 size={16} className="animate-spin" strokeWidth={2} /> Reenviando...</>
            ) : resent ? (
              <><CheckCircle size={16} className="text-[#5B9B7A]" strokeWidth={2} /> Email reenviado</>
            ) : (
              "Reenviar email"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
