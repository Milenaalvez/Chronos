import { useState, useEffect } from "react"
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, User, Building2, Briefcase, Mail, Check, Phone, FileText } from "lucide-react"
import { useTheme } from "../contexts/ThemeContext"
import { auth, setToken, setRefreshToken } from "../services/api"
import { supabase } from "../services/supabase"

import { ForgotPasswordModal } from "../componentes/ForgotPasswordModal"
import { toast } from "../componentes/Toast"
import { ChronosBrand } from "../componentes/ChronosBrand"
import { maskCPF, maskPhone, validateEmail, validateCPF } from "../utils/masks"
import loginImg from "../../../fotos/login.png"
import criarContaImg from "../../../fotos/criar-conta.png"

interface LoginPageProps {
  onLogin: (userData?: any, newRefreshToken?: string, rememberMe?: boolean) => void
}

type AuthView = "login" | "register"

export function LoginPage({ onLogin }: LoginPageProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const [authView, setAuthView] = useState<AuthView>("login")
  const [forgotOpen, setForgotOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callback = params.get('auth_callback')
    if (callback === 'verification' || callback === 'recovery') {
      handleAuthCallback()
    }
  }, [])

  async function handleAuthCallback() {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        const { data: data2, error: error2 } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error2 || !data2.session) {
          console.warn('Auth callback failed:', error2)
          return
        }
        await processSupabaseSession(data2.session)
      } else {
        await processSupabaseSession(data.session)
      }
    } catch (err) {
      console.warn('Auth callback error:', err)
    } finally {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  async function processSupabaseSession(session: any) {
    try {
      const res = await auth.loginSupabase(session.access_token)
      setToken(res.token)
      setRefreshToken(res.refreshToken)
      toast({ type: "success", title: "Bem-vindo!", message: `Que bom te ver, ${res.user.name}! 🤖` })
      onLogin(res.user)
    } catch (err: any) {
      toast({ type: "error", title: "Erro", message: err.message || "Falha ao autenticar" })
    }
  }

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const [regNome, setRegNome] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regCpf, setRegCpf] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regEmpresa, setRegEmpresa] = useState("")
  const [regCargo, setRegCargo] = useState("")
  const [regSenha, setRegSenha] = useState("")
  const [regConfirmar, setRegConfirmar] = useState("")
  const [showRegSenha, setShowRegSenha] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)

  const [loginFieldErrors, setLoginFieldErrors] = useState<Record<string, string>>({})
  const [regFieldErrors, setRegFieldErrors] = useState<Record<string, string>>({})



  function validateLoginFields(): boolean {
    const errors: Record<string, string> = {}
    if (!email) errors.email = "Informe seu email ou matrícula"
    else if (email.includes('@') && !validateEmail(email)) errors.email = "Email inválido"
    setLoginFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function validateRegisterFields(): boolean {
    const errors: Record<string, string> = {}
    if (!regNome || regNome.trim().length < 2) errors.name = "Nome deve ter pelo menos 2 caracteres"
    if (!regEmail) errors.email = "Informe seu email"
    else if (!validateEmail(regEmail)) errors.email = "Email inválido"
    if (!regCpf || !validateCPF(regCpf)) errors.cpf = "CPF inválido ou não informado"
    if (regPhone && regPhone.replace(/\D/g, "").length < 10) errors.phone = "Telefone incompleto"
    if (!regSenha) errors.password = "Crie uma senha"
    else if (regSenha.length < 8) errors.password = "Mínimo 8 caracteres"
    else if (!/[A-Z]/.test(regSenha)) errors.password = "Deve conter uma letra maiúscula"
    else if (!/\d/.test(regSenha)) errors.password = "Deve conter um número"
    if (regSenha !== regConfirmar) errors.confirm = "Senhas não conferem"
    if (!acceptTerms) errors.terms = "Aceite os termos de uso"
    setRegFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!validateLoginFields()) return
    setLoading(true)
    try {
      const res = await auth.login(email, password, rememberMe)
      setToken(res.token)
      setRefreshToken(res.refreshToken, rememberMe)
      toast({ type: "success", title: "Bem-vindo!", message: `Que bom te ver, ${res.user.name}! 🤖` })
      onLogin(res.user, res.refreshToken, rememberMe)
    } catch (err: any) {
      const msg = err.message || "Email ou senha incorretos"
      toast({ type: "error", title: "Erro ao entrar", message: msg })
      setLoginFieldErrors({ form: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!validateRegisterFields()) return
    setLoading(true)
    try {
      const res = await auth.register({
        name: regNome.trim(),
        email: regEmail,
        password: regSenha,
        cpf: regCpf,
        phone: regPhone,
        position: regCargo || undefined,
        companySlug: regEmpresa || undefined,
      })
      setToken(res.token)
      setRefreshToken(res.refreshToken)
      toast({
        type: "success",
        title: "Bem-vindo ao Chronos!",
        message: `Olá, ${res.user.name}. Sua matrícula é ${res.registrationNumber}`
      })
      onLogin(res.user, res.refreshToken)
    } catch (err: any) {
      const msg = err.message || "Erro ao criar conta"
      toast({ type: "error", title: "Erro", message: msg })
      if (msg.includes("CPF")) setRegFieldErrors((prev) => ({ ...prev, cpf: msg }))
      else if (msg.includes("email") || msg.includes("Email")) setRegFieldErrors((prev) => ({ ...prev, email: msg }))
      else setRegFieldErrors((prev) => ({ ...prev, form: msg }))
    } finally {
      setLoading(false)
    }
  }

  const loginValid = email.length > 0 && password.length >= 3
  const registerValid = regNome.trim().length >= 2 && validateEmail(regEmail) && regSenha.length >= 6 && regSenha === regConfirmar && acceptTerms
  const inputClass = `w-full h-11 px-4 rounded-lg text-sm outline-none transition-all duration-200 ${
    isDark
      ? "bg-[#111827] text-[#F8FAFC] placeholder-[#94A3B8]/50 border border-[#1E293B] focus:border-[#8AAEE0] hover:border-[#1E293B]/80"
      : "bg-white text-[#1B2A41] placeholder-[#8A97AB] border border-[#D5DEEF] focus:border-[#8AAEE0] hover:border-[#B1C9EF] shadow-sm"
  }`

  const inputErrorClass = `border-[#D94A4A]/60 focus:border-[#D94A4A]`

  const labelClass = `text-xs font-semibold uppercase tracking-wider ${
    isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"
  }`

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={`hidden lg:flex w-[45%] flex-col items-center justify-between px-10 xl:px-14 py-8 relative select-none ${
          isDark ? "bg-[#060816]" : "bg-[#F8FAFC]"
        }`}
      >
        <div className="w-full max-w-md relative z-10">
          <ChronosBrand size="xl" dark={isDark} showSubtitle />
        </div>

        <div className="relative z-10 w-full flex-1 mx-auto flex items-center justify-center min-h-0">
          <img
            src={authView === "login" ? loginImg : criarContaImg}
            alt={authView === "login" ? "Login" : "Criar conta"}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="w-full max-w-md relative z-10">
          {authView === "login" ? (
            <>
              <h2 className={`text-3xl font-extrabold leading-tight tracking-tight mb-2 whitespace-nowrap ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                Mais controle. Mais produtividade.
              </h2>
              <p className={`text-base leading-snug ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                Mais tempo para o que importa.
              </p>
            </>
          ) : (
            <>
              <h2 className={`text-3xl font-extrabold leading-tight tracking-tight mb-2 whitespace-nowrap ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                Mais organização. Mais clareza.
              </h2>
              <p className={`text-base leading-snug ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                Comece agora a gerenciar sua rotina profissional de forma moderna e inteligente.
              </p>
            </>
          )}
        </div>
      </div>

      <div className={`flex-1 flex items-center justify-center px-6 lg:px-16 relative ${
        isDark ? "bg-[#0B1120]" : "bg-[#FFFFFF]"
      }`}>
        <div className="w-full max-w-[480px] py-12">
          <div className="flex lg:hidden mb-10">
            <ChronosBrand size="sm" dark={isDark} showSubtitle />
          </div>

          {authView === "login" && (
            <div key="login" className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className={`text-2xl font-bold tracking-tight mb-1.5 ${isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"}`}>Acesse sua conta</h2>
              <p className={`text-sm mb-9 ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"}`}>
                Gerencie sua jornada de trabalho com praticidade e organização.
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Email ou matrícula</label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLoginFieldErrors((p) => ({ ...p, email: "", form: "" })) }}
                    placeholder="seu@email.com ou matrícula"
                    className={`${inputClass} ${loginFieldErrors.email ? inputErrorClass : ""}`}
                    autoComplete="email"
                  />
                  {loginFieldErrors.email && (
                    <span className="text-xs text-[#D94A4A] mt-0.5">{loginFieldErrors.email}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLoginFieldErrors((p) => ({ ...p, password: "", form: "" })) }}
                      placeholder="••••••••"
                      className={`${inputClass} pr-11 ${loginFieldErrors.password ? inputErrorClass : ""}`}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                        isDark ? "text-[#94A3B8]/50 hover:text-[#F8FAFC]" : "text-[#8A97AB] hover:text-[#5F6F89]"
                      }`}
                    >
                      {showPassword ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                    </button>
                  </div>
                  {loginFieldErrors.password && (
                    <span className="text-xs text-[#D94A4A] mt-0.5">{loginFieldErrors.password}</span>
                  )}
                </div>

                {loginFieldErrors.form && (
                  <div className="rounded-xl bg-[#D94A4A]/10 border border-[#D94A4A]/30 p-3">
                    <p className="text-xs text-[#D94A4A]">{loginFieldErrors.form}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setRememberMe(!rememberMe)}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 ${
                      isDark
                        ? `${rememberMe ? "bg-[#1D8FF8] border-[#1D8FF8]" : "border-[#1E293B] bg-[#111827]"} group-hover:border-[#8AAEE0]/50`
                        : `${rememberMe ? "bg-[#1D8FF8] border-[#1D8FF8]" : "border-[#D5DEEF] bg-[#F8FAFC]"} group-hover:border-[#8AAEE0]`
                    }`}>
                      {rememberMe && <Check size={10} strokeWidth={3} className="text-white" />}
                    </div>
                    <span className={`text-xs font-medium ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"}`}>Lembrar de mim</span>
                  </label>
                  <button type="button" onClick={() => setForgotOpen(true)}
                    className={`text-xs font-medium transition-colors duration-200 ${
                      isDark ? "text-[#8AAEE0] hover:text-[#628ECB]" : "text-[#628ECB] hover:text-[#395886]"
                    }`}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button type="submit" disabled={!loginValid || loading}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-2.5">
                      <Loader2 size={16} className="animate-spin" strokeWidth={2} />
                      Entrando...
                    </span>
                  ) : (
                    <><span>Entrar</span><ArrowRight size={16} strokeWidth={2} /></>
                  )}
                </button>
              </form>

              <p className={`text-xs text-center mt-8 ${isDark ? "text-[#94A3B8]" : "text-[#8A97AB]"}`}>
                Ainda não tem uma conta?{" "}
                <button type="button" onClick={() => { setAuthView("register"); setRegFieldErrors({}) }}
                  className={`font-medium transition-colors duration-200 ${
                    isDark ? "text-[#8AAEE0] hover:text-[#628ECB]" : "text-[#628ECB] hover:text-[#395886]"
                  }`}
                >
                  Criar conta
                </button>
              </p>
            </div>
          )}

          {authView === "register" && (
            <div key="register" className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <button type="button" onClick={() => { setAuthView("login"); setRegFieldErrors({}) }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isDark ? "text-[#94A3B8] hover:bg-[#111827] hover:text-[#F8FAFC]" : "text-[#8A97AB] hover:bg-[#F8FAFC] hover:text-[#1B2A41]"
                  }`}
                >
                  <ArrowLeft size={16} strokeWidth={2} />
                </button>
                <div>
                  <h2 className={`text-2xl font-bold tracking-tight ${isDark ? "text-[#F8FAFC]" : "text-[#1B2A41]"}`}>Crie sua conta</h2>
                </div>
              </div>

              <form onSubmit={handleRegister} className="flex flex-col gap-3.5" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Nome completo</label>
                    <div className="relative">
                      <User size="15" strokeWidth={1.5} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/40" : "text-[#8A97AB]"}`} />
                      <input
                        type="text"
                        value={regNome}
                        onChange={(e) => { setRegNome(e.target.value); setRegFieldErrors((p) => ({ ...p, name: "" })) }}
                        placeholder="Seu nome"
                        className={`${inputClass} pl-9 ${regFieldErrors.name ? inputErrorClass : ""}`}
                        autoComplete="name"
                      />
                    </div>
                    {regFieldErrors.name && <span className="text-xs text-[#D94A4A]">{regFieldErrors.name}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>CPF</label>
                    <div className="relative">
                      <FileText size="15" strokeWidth={1.5} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/40" : "text-[#8A97AB]"}`} />
                      <input
                        type="text"
                        value={regCpf}
                        onChange={(e) => { setRegCpf(maskCPF(e.target.value)); setRegFieldErrors((p) => ({ ...p, cpf: "" })) }}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className={`${inputClass} pl-9 ${regFieldErrors.cpf ? inputErrorClass : ""}`}
                        autoComplete="off"
                      />
                    </div>
                    {regFieldErrors.cpf && <span className="text-xs text-[#D94A4A]">{regFieldErrors.cpf}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Email corporativo</label>
                    <div className="relative">
                      <Mail size="15" strokeWidth={1.5} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/40" : "text-[#8A97AB]"}`} />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => { setRegEmail(e.target.value); setRegFieldErrors((p) => ({ ...p, email: "" })) }}
                        placeholder="seu@empresa.com"
                        className={`${inputClass} pl-9 ${regFieldErrors.email ? inputErrorClass : ""}`}
                    autoComplete="username"
                      />
                    </div>
                    {regFieldErrors.email && <span className="text-xs text-[#D94A4A]">{regFieldErrors.email}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Telefone</label>
                    <div className="relative">
                      <Phone size="15" strokeWidth={1.5} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/40" : "text-[#8A97AB]"}`} />
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => { setRegPhone(maskPhone(e.target.value)); setRegFieldErrors((p) => ({ ...p, phone: "" })) }}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                        className={`${inputClass} pl-9 ${regFieldErrors.phone ? inputErrorClass : ""}`}
                        autoComplete="tel"
                      />
                    </div>
                    {regFieldErrors.phone && <span className="text-xs text-[#D94A4A]">{regFieldErrors.phone}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Empresa</label>
                    <div className="relative">
                      <Building2 size="15" strokeWidth={1.5} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/40" : "text-[#8A97AB]"}`} />
                      <input type="text" value={regEmpresa} onChange={(e) => setRegEmpresa(e.target.value)} placeholder="Nome da empresa" className={`${inputClass} pl-9`} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Cargo</label>
                    <div className="relative">
                      <Briefcase size="15" strokeWidth={1.5} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#94A3B8]/40" : "text-[#8A97AB]"}`} />
                      <input type="text" value={regCargo} onChange={(e) => setRegCargo(e.target.value)} placeholder="Seu cargo" className={`${inputClass} pl-9`} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Senha</label>
                    <div className="relative">
                      <input
                        type={showRegSenha ? "text" : "password"}
                        value={regSenha}
                        onChange={(e) => { setRegSenha(e.target.value); setRegFieldErrors((p) => ({ ...p, password: "" })) }}
                        placeholder="••••••"
                        className={`${inputClass} pr-10 ${regFieldErrors.password ? inputErrorClass : ""}`}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowRegSenha(!showRegSenha)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? "text-[#94A3B8]/50 hover:text-[#F8FAFC]" : "text-[#8A97AB] hover:text-[#5F6F89]"}`}
                      >
                        {showRegSenha ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                      </button>
                    </div>
                    {regFieldErrors.password && <span className="text-xs text-[#D94A4A]">{regFieldErrors.password}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Confirmar</label>
                    <input
                      type={showRegSenha ? "text" : "password"}
                      value={regConfirmar}
                      onChange={(e) => { setRegConfirmar(e.target.value); setRegFieldErrors((p) => ({ ...p, confirm: "" })) }}
                      placeholder="••••••"
                      className={`${inputClass} ${regFieldErrors.confirm ? inputErrorClass : ""}`}
                      autoComplete="new-password"
                    />
                    {regFieldErrors.confirm && <span className="text-xs text-[#D94A4A]">{regFieldErrors.confirm}</span>}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer group mt-1" onClick={() => setAcceptTerms(!acceptTerms)}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 ${
                    isDark
                      ? `${acceptTerms ? "bg-[#1D8FF8] border-[#1D8FF8]" : "border-[#1E293B] bg-[#111827]"} group-hover:border-[#8AAEE0]/50`
                      : `${acceptTerms ? "bg-[#1D8FF8] border-[#1D8FF8]" : "border-[#D5DEEF] bg-[#F8FAFC]"} group-hover:border-[#8AAEE0]`
                  }`}>
                    {acceptTerms && <Check size={10} strokeWidth={3} className="text-white" />}
                  </div>
                  <span className={`text-xs ${isDark ? "text-[#94A3B8]" : "text-[#5F6F89]"}`}>
                    Aceito os{" "}
                    <a href="#" className={`font-medium ${isDark ? "text-[#8AAEE0]" : "text-[#628ECB]"}`}>termos de uso</a>
                  </span>
                </label>

                {regFieldErrors.form && (
                  <div className="rounded-xl bg-[#D94A4A]/10 border border-[#D94A4A]/30 p-3">
                    <p className="text-xs text-[#D94A4A]">{regFieldErrors.form}</p>
                  </div>
                )}

                <button type="submit" disabled={!registerValid || loading}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#1D8FF8] text-sm font-bold text-white hover:bg-[#0B72D6] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-2.5">
                      <Loader2 size={16} className="animate-spin" strokeWidth={2} />
                      Criando conta...
                    </span>
                  ) : (
                    <><span>Criar conta</span><ArrowRight size={16} strokeWidth={2} /></>
                  )}
                </button>
              </form>

              <p className={`text-xs text-center mt-8 ${isDark ? "text-[#94A3B8]" : "text-[#8A97AB]"}`}>
                Já tem uma conta?{" "}
                <button type="button" onClick={() => { setAuthView("login"); setRegFieldErrors({}) }}
                  className={`font-medium transition-colors duration-200 ${
                    isDark ? "text-[#8AAEE0] hover:text-[#628ECB]" : "text-[#628ECB] hover:text-[#395886]"
                  }`}
                >
                  Fazer login
                </button>
              </p>
            </div>
          )}
        </div>

        {forgotOpen && (
          <ForgotPasswordModal onClose={() => setForgotOpen(false)} />
        )}
      </div>
    </div>
  )
}
