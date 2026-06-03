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
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callback = params.get('auth_callback')
    if (callback === 'google') {
      handleGoogleCallback()
    } else if (callback === 'verification' || callback === 'recovery') {
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

  async function handleGoogleCallback() {
    try {
      setGoogleLoading(true)
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        const { data: data2, error: error2 } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error2 || !data2.session) {
          console.warn('Google auth callback failed:', error2)
          return
        }
        await processGoogleSession(data2.session)
      } else {
        await processGoogleSession(data.session)
      }
    } catch (err) {
      console.warn('Google auth error:', err)
    } finally {
      setGoogleLoading(false)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  async function processGoogleSession(session: any) {
    const user = session.user
    if (!user || !user.email) {
      toast({ type: 'error', title: 'Erro', message: 'Não foi possível obter dados do Google.' })
      return
    }
    try {
      const res = await auth.google({
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      })
      setToken(res.token)
      setRefreshToken(res.refreshToken)
      toast({ type: 'success', title: 'Bem-vindo!', message: `Que bom te ver, ${res.user.name}! 🤖` })
      onLogin(res.user)
    } catch (err: any) {
      toast({ type: 'error', title: 'Erro', message: err.message || 'Falha ao autenticar com Google' })
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}?auth_callback=google`,
        },
      })
      if (error) {
        toast({ type: 'info', title: 'Google', message: 'Login com Google está em desenvolvimento. Use email e senha.' })
        setGoogleLoading(false)
      }
    } catch (err) {
      toast({ type: 'info', title: 'Google', message: 'Login com Google está em desenvolvimento. Use email e senha.' })
      setGoogleLoading(false)
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
    if (regCpf && !validateCPF(regCpf)) errors.cpf = "CPF inválido"
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

              <Divider isDark={isDark} />

              <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}
                className={`flex items-center justify-center gap-3 w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-transparent border border-[#1E293B] text-[#F8FAFC] hover:bg-[#111827] hover:border-[#1E293B]/80"
                    : "bg-white border border-[#D5DEEF] text-[#1B2A41] hover:bg-[#F8FAFC] hover:border-[#B1C9EF]"
                }`}
              >
                {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleLogo />}
                {googleLoading ? "Conectando..." : "Entrar com Google"}
              </button>

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

              <Divider isDark={isDark} />

              <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}
                className={`flex items-center justify-center gap-3 w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark
                    ? "bg-transparent border border-[#1E293B] text-[#F8FAFC] hover:bg-[#111827] hover:border-[#1E293B]/80"
                    : "bg-white border border-[#D5DEEF] text-[#1B2A41] hover:bg-[#F8FAFC] hover:border-[#B1C9EF]"
                }`}
              >
                {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleLogo />}
                {googleLoading ? "Conectando..." : "Cadastrar com Google"}
              </button>

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

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-4 my-7">
      <div className={`flex-1 h-px ${isDark ? "bg-[#1E293B]" : "bg-[#D5DEEF]"}`} />
      <span className={`text-xs font-medium ${isDark ? "text-[#94A3B8]/50" : "text-[#8A97AB]"}`}>ou</span>
      <div className={`flex-1 h-px ${isDark ? "bg-[#1E293B]" : "bg-[#D5DEEF]"}`} />
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
