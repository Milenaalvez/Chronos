import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useTheme } from "../contexts/ThemeContext"
import { auth as apiAuth, setToken } from "../services/api"

interface VerifyEmailPageProps {
  onVerified: (user?: any) => void
}

export function VerifyEmailPage({ onVerified }: VerifyEmailPageProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    if (!token) {
      setStatus("error")
      setMessage("Token de verificação não encontrado.")
      return
    }
    apiAuth.verifyEmail(token)
      .then((res) => {
        setToken(res.token)
        setStatus("success")
        setMessage(res.message || "Email verificado com sucesso!")
        setTimeout(() => onVerified(res.user), 2000)
      })
      .catch((err: any) => {
        setStatus("error")
        setMessage(err?.message || "Erro ao verificar email.")
      })
  }, [onVerified])

  const bg = isDark ? "bg-[#0B1120]" : "bg-white"
  const cardBg = isDark ? "bg-[#111827]" : "bg-[#F8FAFC]"
  const textColor = isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"
  const mutedColor = isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"

  return (
    <div className={`h-screen ${bg} flex items-center justify-center`}>
      <div className={`w-full max-w-md mx-4 p-8 rounded-2xl ${cardBg} border border-default/30 text-center`}>
        {status === "loading" && (
          <>
            <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[#1D8FF8]" />
            <h2 className={`text-lg font-bold ${textColor}`}>Verificando...</h2>
            <p className={`text-sm ${mutedColor} mt-1`}>Aguarde enquanto verificamos seu email.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={40} className="mx-auto mb-4 text-accent-green" />
            <h2 className={`text-lg font-bold ${textColor}`}>Email verificado!</h2>
            <p className={`text-sm ${mutedColor} mt-1`}>{message}</p>
            <p className={`text-xs ${mutedColor} mt-4`}>Redirecionando...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={40} className="mx-auto mb-4 text-accent-red" />
            <h2 className={`text-lg font-bold ${textColor}`}>Falha na verificação</h2>
            <p className={`text-sm ${mutedColor} mt-1`}>{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
