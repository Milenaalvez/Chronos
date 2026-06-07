import React, { useState, useMemo, useCallback, useEffect, useRef, type ErrorInfo, type ReactNode } from "react"
import { useTheme } from "./contexts/ThemeContext"

class ErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('=== RENDER ERROR ===', error, info)
  }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>
        <h2>Erro de renderização</h2>
        <pre>{this.state.error.message}</pre>
        <pre>{this.state.error.stack}</pre>
      </div>
    }
    return this.props.children
  }
}
import { Sidebar } from "./componentes/Sidebar"
import { RegisterModal } from "./componentes/RegisterModal"
import { FeedbackModal } from "./componentes/FeedbackModal"
import { ToastContainer } from "./componentes/Toast"
import { DashboardPage } from "./paginas/DashboardPage"
import { BancoHorasPage } from "./paginas/BancoHorasPage"
import { RegistrosPage } from "./paginas/RegistrosPage"
import { RelatoriosPage } from "./paginas/RelatoriosPage"
import { CalendarioPage } from "./paginas/CalendarioPage"
import { NotificacoesPage } from "./paginas/NotificacoesPage"
import { ConfiguracoesPage } from "./paginas/ConfiguracoesPage"
import { EquipePage } from "./paginas/EquipePage"
import { PerfilPage } from "./paginas/PerfilPage"
import { LoginPage } from "./paginas/LoginPage"
import { VerifyEmailPage } from "./paginas/VerifyEmailPage"
import { ResetPasswordPage } from "./paginas/ResetPasswordPage"
import { VerificationRequiredPage } from "./paginas/VerificationRequiredPage"
import { DiagnosticoPage } from "./paginas/DiagnosticoPage"
import { RegistrarPontoPage } from "./paginas/RegistrarPontoPage"
import { JustificativasPage } from "./paginas/JustificativasPage"
import { EmAnalisePage } from "./paginas/EmAnalisePage"
import { AuditoriaPage } from "./paginas/AuditoriaPage"
import { MeusRegistrosPage } from "./paginas/MeusRegistrosPage"
import { FeriasPage } from "./paginas/FeriasPage"
import { AdminEmpresaPage } from "./paginas/AdminEmpresaPage"
import { SuperAdminPage } from "./paginas/SuperAdminPage"
import type { TimeRecord, FormData, Justificacao, WorkflowNotification, PageAction } from "./types"
import { toMinutes, formatMinutes, formatDataBR } from "./types"
import { timeRecords as apiRecords, justifications as apiJust, auth as apiAuth, getToken, setToken, getRefreshToken, setRefreshToken, setOnAuthExpired, notifications as apiNotifs, termAcceptance as apiTermAcceptance, faceRegistration as apiFaceRegistration } from "./services/api"
import { TermsOfUseModal } from "./componentes/TermsOfUseModal"
import { FaceRegistrationModal } from "./componentes/FaceRegistrationModal"
import { canAccessPage, getEffectiveRole, ROLE_LABELS } from "./utils/permissions"

let nextId = 1
function genId() {
  return `rec_${nextId++}`
}

let notifId = 1
function genNotifId() {
  return `wf_${notifId++}`
}

function parseTimeValue(t: string): number | null {
  if (!t || t === '---') return null
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function apiRecordToTimeRecord(r: any): TimeRecord {
  const dateISO = r.date ? String(r.date).substring(0, 10) : ''
  const [y, m, d] = dateISO.split('-')
  const data = d && m && y ? `${d}/${m}/${y}` : ''
  const hasClockOut = !!r.clockOut

  let totalMins = r.totalMinutes || 0
  if (!hasClockOut && r.clockIn) {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (dateISO === today) {
      const ci = parseTimeValue(r.clockIn)
      const bs = parseTimeValue(r.breakStart)
      const be = parseTimeValue(r.breakEnd)
      const now = new Date()
      const currentMins = now.getHours() * 60 + now.getMinutes()
      if (ci !== null) {
        const norm = (t: number) => t > currentMins ? t - 1440 : t
        const nci = norm(ci)
        const nbs = bs !== null ? norm(bs) : null
        const nbe = be !== null ? norm(be) : null
        let worked = currentMins - nci
        if (nbs !== null && nbe !== null) worked -= (nbe - nbs)
        else if (nbs !== null && nbe === null) worked = nbs - nci
        totalMins = Math.max(Math.round(worked), 0)
      }
    }
  }

  const totalH = totalMins / 60
  let tipo: TimeRecord['tipo'] = 'Normal'
  if (!hasClockOut) tipo = 'Pendente'
  else if (totalMins < 0) tipo = 'Negativo'
  else if (r.status === 'OVERTIME' || totalMins > 480) tipo = 'Extra'
  else if (r.status === 'ABSENCE' || totalMins < 240) tipo = 'Afastamento'
  return {
    id: r.id || '',
    data,
    dataISO: dateISO,
    entrada: r.clockIn || '---',
    saidaIntervalo: r.breakStart || '---',
    retornoIntervalo: r.breakEnd || '---',
    saida: r.clockOut || '---',
    total: formatMinutes(totalMins),
    totalHours: Math.round(totalH * 100) / 100,
    tipo,
  }
}

function buildRecord(fd: FormData): TimeRecord {
  const entrada = fd.entrada
  const saidaIntervalo = fd.saidaIntervalo || fd.retornoIntervalo || "12:00"
  const retornoIntervalo = fd.retornoIntervalo || fd.saidaIntervalo || "13:00"
  const saida = fd.saida || "17:00"

  const morning = toMinutes(saidaIntervalo) - toMinutes(entrada)
  const afternoon = toMinutes(saida) - toMinutes(retornoIntervalo)
  const totalMins = morning + afternoon
  const totalHours = totalMins / 60
  const totalDisplay = formatMinutes(totalMins)

  let tipo: TimeRecord["tipo"] = "Normal"
  if (totalMins < 0) tipo = "Negativo"
  else if (totalMins > 480) tipo = "Extra"
  else if (totalMins < 240) tipo = "Afastamento"

  return {
    id: genId(),
    data: formatDataBR(fd.data),
    dataISO: fd.data,
    entrada: fd.entrada,
    saidaIntervalo: fd.saidaIntervalo || "---",
    retornoIntervalo: fd.retornoIntervalo || "---",
    saida: fd.saida || "---",
    total: totalDisplay,
    totalHours,
    tipo,
  }
}

const initialRecords: TimeRecord[] = []

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function generateMissingRecords(existing: TimeRecord[], hireDate?: string): TimeRecord[] {
  if (!hireDate) return []
  const today = todayISO()
  const existingDates = new Set(existing.map((r) => r.dataISO))
  const missing: TimeRecord[] = []
  const start = new Date(hireDate + "T12:00:00")
  const end = new Date(today + "T12:00:00")

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (iso > today) continue
    if (existingDates.has(iso)) continue
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const [y, m, dStr] = iso.split("-")
    missing.push({
      id: genId(),
      data: `${dStr}/${m}/${y}`,
      dataISO: iso,
      entrada: "---",
      saidaIntervalo: "---",
      retornoIntervalo: "---",
      saida: "---",
      total: "---",
      totalHours: 0,
      tipo: "Pendente",
    })
  }
  return missing
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: string; position?: string | null; avatar?: string | null; companyId?: string; hireDate?: string; permissions?: string[]; emailVerified?: boolean; themeMode?: string; themeAccent?: string; cpf?: string | null; phone?: string | null; department?: string | null; registrationNumber?: string | null; employeeCode?: string | null; contractType?: string | null; weeklyHours?: number } | null>(null)
  const [page, setPage] = useState("dashboard")
  const [modalOpen, setModalOpen] = useState(false)
  const [editDate, setEditDate] = useState<string | undefined>(undefined)
  const [records, setRecords] = useState<TimeRecord[]>(initialRecords)
  const [justificacoes, setJustificacoes] = useState<Record<string, Justificacao>>({})
  const [, setWorkflowNotifs] = useState<WorkflowNotification[]>([])
  const [pageAction, setPageAction] = useState<PageAction | null>(null)
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null)
  const [deletedDates, setDeletedDates] = useState<Set<string>>(new Set())
  const [notificationCount, setNotificationCount] = useState(0)
  const notificationRefreshRef = useRef<() => void>(null)
  const { setThemeMode, setThemeAccent } = useTheme()

  const [showTerms, setShowTerms] = useState(false)
  const [showFaceReg, setShowFaceReg] = useState(false)
  const onboardingRef = useRef(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true")
  const [impersonatingRole, setImpersonatingRole] = useState<string | null>(null)

  const effectiveRole = getEffectiveRole(user?.role ?? null, impersonatingRole)

  useEffect(() => {
    if (page === "diagnostico") return
    if (!canAccessPage(effectiveRole, page)) {
      setPage("dashboard")
    }
  }, [page, effectiveRole])

  function handleCollapseChange(v: boolean) {
    setSidebarCollapsed(v)
    localStorage.setItem("sidebar-collapsed", v ? "true" : "false")
  }

  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (prevUserIdRef.current === user.id) return
    prevUserIdRef.current = user.id
    localStorage.removeItem("chronos-theme-mode")
    localStorage.removeItem("chronos-accent")
    if (user.themeMode) setThemeMode(user.themeMode as any)
    if (user.themeAccent) setThemeAccent(user.themeAccent as any)
  }, [user, setThemeMode, setThemeAccent])

  const refreshRecords = useCallback(() => {
    if (!user) return
    apiRecords.list().then((data) => setRecords(data.map(apiRecordToTimeRecord))).catch(() => {})
  }, [user])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault()
        setPage((p) => (p === "diagnostico" ? "dashboard" : "diagnostico"))
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!user) return
    const h = setInterval(refreshRecords, 60000)
    return () => clearInterval(h)
  }, [user, refreshRecords])

  useEffect(() => {
    if (!user) return
    function handleFocus() { refreshRecords() }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [user, refreshRecords])

  const [saveFeedback, setSaveFeedback] = useState<{
    open: boolean
    record?: TimeRecord
  }>({ open: false })

  const [justFeedback, setJustFeedback] = useState<{
    open: boolean
    status: "success" | "pending"
    motivo?: string
    periodo?: string
  }>({ open: false, status: "pending" })

  const hireDate = user?.hireDate
  const allRecords = useMemo(() => {
    const missing = generateMissingRecords(records, hireDate)
    return [...records, ...missing].filter((r) => r.dataISO >= (hireDate || '') && !deletedDates.has(r.dataISO))
  }, [records, deletedDates, hireDate])

  useEffect(() => {
    if (authenticated && allRecords.length > 0 && import.meta.env.DEV) {
      import('./services/validation').then(({ validateConsistency, reportValidation }) => {
        const result = validateConsistency(allRecords, justificacoes)
        if (!result.passed) reportValidation(result)
      })
    }
  }, [authenticated, allRecords, justificacoes])

  const handleSave = useCallback((fd: FormData) => {
    const isPartial = !fd.saida
    const rec = isPartial
      ? {
          id: genId(),
          data: formatDataBR(fd.data),
          dataISO: fd.data,
          entrada: fd.entrada,
          saidaIntervalo: "---",
          retornoIntervalo: "---",
          saida: "---",
          total: "---",
          totalHours: 0,
          tipo: "Pendente" as const,
        }
      : buildRecord(fd)
    setRecords((prev) => {
      const filtered = prev.filter((r) => r.dataISO !== fd.data || r.tipo !== "Pendente")
      return [rec, ...filtered]
    })
    setDeletedDates((prev) => { const next = new Set(prev); next.delete(fd.data); return next })
    setModalOpen(false)
    setEditDate(undefined)

    apiRecords.upsert({
      date: fd.data,
      clockIn: fd.entrada,
      ...(fd.saida ? { clockOut: fd.saida } : {}),
      ...(fd.saidaIntervalo && fd.saidaIntervalo !== "---" ? { breakStart: fd.saidaIntervalo } : {}),
      ...(fd.retornoIntervalo && fd.retornoIntervalo !== "---" ? { breakEnd: fd.retornoIntervalo } : {}),
    }).then(() => {
      return apiRecords.list().then((data) => setRecords(data.map(apiRecordToTimeRecord)))
    }).then(() => {
    apiNotifs.refresh().catch(() => {})
    }).catch((err) => {
      console.warn('[App] Erro ao salvar registro:', err)
    })

    setSaveFeedback({ open: true, record: rec })
    setWorkflowNotifs((prev) => [
      {
        id: genNotifId(),
        tipo: "informativo",
        titulo: isPartial ? "Entrada registrada" : "Registro realizado",
        mensagem: isPartial
          ? `Entrada às ${fd.entrada} registrada. Não esqueça de registrar a saída no final do dia.`
          : `Seu ponto do dia ${formatDataBR(fd.data)} foi registrado com sucesso.`,
        timestamp: "Hoje",
        lida: false,
        acao: { pagina: "calendario", dataISO: fd.data },
      },
      ...prev,
    ])
  }, [])

  const handleEdit = useCallback((dataISO: string) => {
    setEditDate(dataISO)
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback((dataISO: string) => {
    setRecords((prev) => prev.filter((r) => r.dataISO !== dataISO))
    setDeletedDates((prev) => new Set(prev).add(dataISO))
  }, [])

  const handleJustificar = useCallback((data: Justificacao) => {
    setJustificacoes((prev) => {
      const next = { ...prev }
      const start = new Date(data.dataInicio + "T12:00:00")
      const end = new Date(data.dataFim + "T12:00:00")
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        next[iso] = data
      }
      return next
    })

    apiJust.create({
      reason: data.motivo,
      description: data.observacao,
      startDate: data.dataInicio,
      endDate: data.dataFim,
    }).catch((err) => {
      console.warn('[App] Erro ao salvar justificativa no backend:', err)
    })

    const autoApprove = [
      "Usuário novo / onboarding",
      "Profissional ainda não contratado",
      "Problema no sistema",
    ]
    const isApproved = autoApprove.includes(data.motivo)
    const periodo = `${formatDataBR(data.dataInicio)} → ${formatDataBR(data.dataFim)}`

    setJustFeedback({
      open: true,
      status: isApproved ? "success" : "pending",
      motivo: data.motivo,
      periodo,
    })

    if (isApproved) {
      setWorkflowNotifs((prev) => [
        {
          id: genNotifId(),
          tipo: "informativo",
          titulo: "Justificativa aprovada",
          mensagem: `Seu afastamento${data.dataInicio !== data.dataFim ? ` de ${formatDataBR(data.dataInicio)} a ${formatDataBR(data.dataFim)}` : ` do dia ${formatDataBR(data.dataInicio)}`} foi aprovado e abonado.`,
          timestamp: "Hoje",
          lida: false,
          status: "aprovado",
          acao: { pagina: "calendario", dataISO: data.dataInicio },
        },
        ...prev,
      ])
    } else {
      setWorkflowNotifs((prev) => [
        {
          id: genNotifId(),
          tipo: "pendencia",
          titulo: "Justificativa em análise",
          mensagem: `Sua justificativa para ${periodo} foi enviada ao RH e está aguardando aprovação.`,
          timestamp: "Hoje",
          lida: false,
          status: "em_analise",
          acao: { pagina: "calendario", dataISO: data.dataInicio },
        },
        ...prev,
      ])
    }
  }, [])

  const handleClearAction = useCallback(() => {
    setPageAction(null)
  }, [])

  const handleLogin = useCallback((userData?: any, newRefreshToken?: string, remMe?: boolean) => {
    setAuthenticated(true)
    setUser(userData || null)
    if (newRefreshToken) setRefreshToken(newRefreshToken, remMe)
    setRecords([])
    setJustificacoes({})
    apiNotifs.refresh().catch(() => {})
    apiNotifs.unreadCount().then((r) => setNotificationCount(r.count)).catch(() => {})
  }, [])

  const handleRefreshUser = useCallback((userData: any) => {
    setUser(userData)
  }, [])

  const handleLogout = useCallback(() => {
    apiAuth.logout().catch(() => {})
    setToken(null)
    setRefreshToken(null)
    setAuthenticated(false)
    setUser(null)
    setRecords([])
    setJustificacoes({})
    prevUserIdRef.current = null
    localStorage.removeItem("chronos-theme-mode")
    localStorage.removeItem("chronos-accent")
  }, [])

  useEffect(() => {
    setOnAuthExpired((_reason) => {
      setAuthenticated(false)
      setUser(null)
    })
    return () => setOnAuthExpired(null)
  }, [])

  // Restore session on mount
  useEffect(() => {
    const savedToken = getToken()
    const savedRefresh = getRefreshToken()
    if (savedToken && savedRefresh) {
      apiAuth.me()
        .then((u) => {
          setUser(u)
          setAuthenticated(true)
        })
        .catch(() => {
          // If /auth/me fails, the interceptor in api.ts will try refresh
          // If refresh also fails, onAuthExpired will fire
        })
        .finally(() => setRestoring(false))
    } else {
      setRestoring(false)
    }
  }, [])

  useEffect(() => {
    if (!authenticated || !getToken()) return
    if (!user) {
      apiAuth.me().then((u) => {
        setUser(u)
        refreshRecords()
      }).catch(() => {})
    } else {
      refreshRecords()
    }
    apiJust.list().then((data) => {
      const justMap: Record<string, Justificacao> = {}
      if (Array.isArray(data)) {
        for (const j of data) {
          const startDateStr = String(j.startDate).substring(0, 10)
          const endDateStr = String(j.endDate).substring(0, 10)
          const start = new Date(startDateStr + 'T12:00:00')
          const end = new Date(endDateStr + 'T12:00:00')
          const status = j.status === 'APPROVED' ? 'aprovado' as const : j.status === 'REJECTED' ? 'recusado' as const : 'em_analise' as const
          const just: Justificacao = {
            motivo: j.reason,
            observacao: j.description || '',
            anexoNome: '',
            dataInicio: startDateStr,
            dataFim: endDateStr,
            status,
          }
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            justMap[iso] = just
          }
        }
      }
      setJustificacoes(justMap)
    }).catch((err) => console.warn('[App] Erro ao carregar justificativas:', err))
    apiNotifs.refresh().then((r) => setNotificationCount(r.count)).catch(() => {})

    // Check onboarding status
    Promise.all([
      apiTermAcceptance.status().catch(() => ({ accepted: false })),
      apiFaceRegistration.status().catch(() => ({ registered: false })),
    ]).then(([terms, face]) => {
      onboardingRef.current = true
      if (!terms.accepted) {
        setShowTerms(true)
      } else if (!face.registered) {
        setShowFaceReg(true)
      }
    }).catch(() => { onboardingRef.current = true })
  }, [authenticated])

  // Poll notificações a cada 30s (sem fetch imediato — já foi feito no useEffect acima)
  useEffect(() => {
    if (!authenticated || !getToken()) return
    const fetch = () => apiNotifs.unreadCount().then((r) => {
      setNotificationCount(r.count)
    }).catch(() => {})
    const id = setInterval(fetch, 30000)
    return () => clearInterval(id)
  }, [authenticated])

  notificationRefreshRef.current = () => {
    if (authenticated && getToken()) {
      apiNotifs.unreadCount().then((r) => setNotificationCount(r.count)).catch(() => {})
    }
  }

  useEffect(() => {
    if (!authenticated) return
    const refresh = () => notificationRefreshRef.current?.()
    window.addEventListener('notifications-refresh', refresh)
    return () => window.removeEventListener('notifications-refresh', refresh)
  }, [authenticated])

  if (restoring) {
    return (
      <div className="h-screen bg-app text-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-secondary">Restaurando sessão...</p>
        </div>
      </div>
    )
  }

  const urlParams = new URLSearchParams(window.location.search)
  const action = urlParams.get('action')

  if (action === 'verify-email' && urlParams.get('token')) {
    return <><ToastContainer /><VerifyEmailPage onVerified={(userData) => {
      if (userData) { setUser(userData); setAuthenticated(true) }
      window.history.replaceState({}, '', window.location.pathname)
    }} /></>
  }

  if (action === 'reset-password' && urlParams.get('token')) {
    return <><ToastContainer /><ResetPasswordPage onReset={() => { window.location.href = window.location.origin + window.location.pathname }} /></>
  }

  if (!authenticated) {
    return (
      <>
        <ToastContainer />
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  if (user && !user.emailVerified) {
    return (
      <>
        <ToastContainer />
        <VerificationRequiredPage user={user} onVerified={handleRefreshUser} onBackToLogin={handleLogout} />
      </>
    )
  }

  const pageComponent = () => {
    if (profileMemberId) {
      return (
        <PerfilPage
          memberId={profileMemberId}
          user={user}
          onBack={() => setProfileMemberId(null)}
          onNavigate={setPage}
          allRecords={allRecords}
          justificacoes={justificacoes}
        />
      )
    }
    switch (page) {
      case "dashboard":
        return (
          <DashboardPage
            records={records}
            allRecords={allRecords}
            justificacoes={justificacoes}
            onEdit={handleEdit}
            onNavigate={setPage}
            user={user ?? undefined}
          />
        )
      case "banco":
        return (
          <BancoHorasPage
            allRecords={allRecords}
            justificacoes={justificacoes}
          />
        )
      case "registros":
        return (
          <RegistrosPage
            allRecords={allRecords}
            justificacoes={justificacoes}
            onEdit={handleEdit}
            onSave={handleSave}
            onJustificar={handleJustificar}
            onDelete={handleDelete}
          />
        )
      case "relatorios":
        return (
          <RelatoriosPage user={user} />
        )
      case "calendario":
        return (
          <CalendarioPage
            records={records}
            allRecords={allRecords}
            onEdit={handleEdit}
            onSave={handleSave}
            justificacoes={justificacoes}
            onJustificar={handleJustificar}
            pageAction={pageAction?.type === "selectDay" ? pageAction : null}
            onClearAction={handleClearAction}
          />
        )
      case "notificacoes":
        return <NotificacoesPage />
      case "configuracoes":
        return <ConfiguracoesPage userId={user?.id} user={user ?? undefined} onAvatarUpdate={(url) => setUser((prev) => prev ? { ...prev, avatar: url } : prev)} />
      case "registrar-ponto":
      case "ponto-registrar":
        return <RegistrarPontoPage user={user ?? undefined} onPointCreated={refreshRecords} />
      case "ponto-meus-registros":
        return (
          <MeusRegistrosPage
            allRecords={allRecords}
            justificacoes={justificacoes}
            onEdit={handleEdit}
            onSave={handleSave}
            onJustificar={handleJustificar}
            onDelete={handleDelete}
          />
        )
      case "ponto-justificativas":
        return <JustificativasPage />
      case "ponto-em-analise":
        return <EmAnalisePage />
      case "ponto-auditoria":
        return <AuditoriaPage />
      case "equipe":
        return <EquipePage user={user} onViewProfile={(id) => setProfileMemberId(id)} allRecords={allRecords} justificacoes={justificacoes} />
      case "ferias":
        return <FeriasPage />
      case "diagnostico":
        return (
          <DiagnosticoPage
            allRecords={allRecords}
            records={records}
            justificacoes={justificacoes}
          />
        )
      case "admin-empresa":
        return <AdminEmpresaPage user={user} />
      case "super-admin":
        return <SuperAdminPage />
      default:
        return (
          <DashboardPage
            records={records}
            allRecords={allRecords}
            justificacoes={justificacoes}
            onEdit={handleEdit}
            onNavigate={setPage}
            user={user ?? undefined}
          />
        )
    }
  }

  return (
    <ErrorBoundary>
    <div className="h-screen bg-app text-primary">
      <ToastContainer />
      <Sidebar activePage={page} onNavigate={(p) => { setPage(p); setProfileMemberId(null); setSidebarOpen(false) }} onLogout={handleLogout} onSwitchAccount={(token, userData, refreshTok) => { setToken(token); if (refreshTok) setRefreshToken(refreshTok); setUser(userData); setPage("dashboard"); }} user={user} notificationCount={notificationCount} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((p) => !p)} collapsed={sidebarCollapsed} onCollapseChange={handleCollapseChange} impersonatingRole={impersonatingRole} onExitImpersonation={() => setImpersonatingRole(null)} onImpersonateRole={(role) => setImpersonatingRole(role)} />

      {impersonatingRole && (
        <div className="fixed top-0 left-0 right-0 z-50 h-8 bg-amber-600/80 backdrop-blur-sm flex items-center justify-center gap-2 text-[11px] font-medium text-white">
          Visualizando como <strong>{ROLE_LABELS[impersonatingRole as keyof typeof ROLE_LABELS] || impersonatingRole}</strong>
          <button onClick={() => setImpersonatingRole(null)} className="ml-2 underline hover:no-underline">Sair</button>
        </div>
      )}
      <main className={`${sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-72"} ${impersonatingRole ? "pt-8" : ""} h-screen px-3 sm:px-6 lg:px-8 py-3 sm:py-6 lg:py-8 overflow-y-auto`}>
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className={`fixed ${impersonatingRole ? "top-10" : "top-3 sm:top-4"} left-3 sm:left-4 z-10 w-11 h-11 rounded-lg bg-surface border border-default/10 flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200 lg:hidden`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        </button>
        <RegisterModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditDate(undefined) }}
          onSave={handleSave}
          editDate={editDate}
        />

        <FeedbackModal
          open={saveFeedback.open}
          onClose={() => setSaveFeedback({ open: false })}
          type="pending"
          title="Jornada registrada"
          message="Seu registro foi salvo e enviado para análise.\nVocê receberá uma notificação quando for aprovado."
          details={saveFeedback.record ? [
            { label: "Entrada", value: saveFeedback.record.entrada },
            { label: "Saída", value: saveFeedback.record.saida },
            { label: "Total do dia", value: saveFeedback.record.total },
          ] : undefined}
          statusText="Aguardando aprovação"
          statusColor="#C49A6B"
          secondaryButton={{
            text: "Ver registro",
            onClick: () => {
              setSaveFeedback({ open: false })
              if (saveFeedback.record) {
                setPageAction({ type: "selectDay", payload: { dataISO: saveFeedback.record.dataISO } })
                setPage("calendario")
              }
            },
          }}
        />

        <FeedbackModal
          open={justFeedback.open}
          onClose={() => setJustFeedback({ open: false, status: "pending" })}
          type={justFeedback.status}
          title="Justificativa enviada"
          message={justFeedback.status === "success"
            ? "Sua justificativa foi aprovada automaticamente.\nAs horas foram abonadas e não impactam seu banco de horas."
            : "Obrigada pela justificativa.\nEla será analisada e em breve você receberá uma notificação informando se foi aprovada ou recusada."}
          details={[
            { label: "Motivo", value: justFeedback.motivo || "" },
            { label: "Período", value: justFeedback.periodo || "" },
          ]}
          statusText={justFeedback.status === "success" ? "Aprovado" : "Em análise"}
          statusColor={justFeedback.status === "success" ? "#5B9B7A" : "#C49A6B"}
          buttonText="Entendi"
        />

        <div className="h-full">
          {pageComponent()}
        </div>
      </main>

      {showTerms && (
        <TermsOfUseModal
          onAccept={async () => {
            await apiTermAcceptance.accept()
            setShowTerms(false)
            const face = await apiFaceRegistration.status().catch(() => ({ registered: false }))
            if (!face.registered) {
              setShowFaceReg(true)
            }
          }}
        />
      )}

      {showFaceReg && (
        <FaceRegistrationModal
          onComplete={async (descriptors, images) => {
            await apiFaceRegistration.register(descriptors, images)
            setShowFaceReg(false)
          }}
          onSkip={() => setShowFaceReg(false)}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}
