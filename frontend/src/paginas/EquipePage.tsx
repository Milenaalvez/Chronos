import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Users, UserCheck, Clock, AlertTriangle, ShieldCheck,
  Search, Loader2, RefreshCw, MoreHorizontal,
  CheckCircle, XCircle, Ban, Trash2, Key,
  Mail, Activity, FileText,
  X, UserPlus, Edit3, Eye,
  ExternalLink,
  Wifi, Lock,
  ThumbsUp, ThumbsDown,
  UserRoundPlus, UserRoundX, TrendingUp, TrendingDown,
} from "lucide-react"
import { team as apiTeam, justifications as apiJust, timeRecords as apiRecords, reference as apiRef } from "../services/api"
import { PageHeader } from "../componentes/PageHeader"
import { canAccess, ALL_PERMISSIONS } from "../utils/permissions"
import { computeFilteredTotals, computeSaldo, getMonthBounds, filterMonthRecords } from "../services/workHoursEngine"
import type { TimeRecord, Justificacao } from "../types"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface EnrichedMember {
  id: string; name: string; email: string; role: string
  department: string | null; departmentId: string | null; position: string | null; positionId: string | null; contractType: string | null
  registrationNumber: string | null; phone: string | null; avatar: string | null; employeeCode: string | null
  weeklyHours: number; workSchedule: string; hireDate: string
  isActive: boolean; emailVerified: boolean; lastAccessAt: string | null
  companyId: string
  todayClockIn: string | null; todayClockOut: string | null
  todayTotalMinutes: number | null; todayStatus: string | null
  monthTotalMinutes: number; balanceHours: number; isOnline: boolean
  pendingJustification: { id: string; reason: string; startDate: string; endDate: string } | null
}

interface MetricsData {
  total: number; active: number; inactive: number; verified: number
  presentToday: number; lateToday: number
  absentToday: number; pendingJustifications: number
  hiresThisMonth: number; deactivationsThisMonth: number
  hiresTrend: 'up' | 'down' | 'stable'
  deactivationsTrend: 'up' | 'down' | 'stable'
}

interface JustItem {
  id: string; reason: string; description: string | null
  status: string; rhResponse: string | null
  startDate: string; endDate: string; createdAt: string
  userId: string
  user: { id: string; name: string; email: string; avatar: string | null; department: string | null }
}

interface ActivityItem {
  id: string; action: string; description: string | null
  entityType: string | null; entityId: string | null
  metadata: Record<string, unknown> | null; timestamp: string
  userId: string; targetUserId: string | null
  user: { id: string; name: string; avatar: string | null; role: string }
  targetUser: { id: string; name: string; avatar: string | null } | null
}

interface PendingReviewItem {
  id: string; clockIn: string; clockOut: string; date: string
  breakStart: string | null; breakEnd: string | null
  totalMinutes: number | null; reviewStatus: string
  user: { id: string; name: string; email: string; avatar: string | null; role: string; department: string | null; position: string | null }
}

type StatusKey = "online" | "late" | "absent" | "offline" | "pending" | "inactive"

const STATUS_CFG: Record<StatusKey, { label: string; color: string; dot: string }> = {
  online:   { label: "Presente",  color: "text-accent-green", dot: "bg-accent-green" },
  late:     { label: "Em atraso", color: "text-accent-amber", dot: "bg-accent-amber" },
  absent:   { label: "Ausente",   color: "text-accent-red",   dot: "bg-accent-red" },
  offline:  { label: "Offline",   color: "text-muted",        dot: "bg-muted" },
  pending:  { label: "Pendente",  color: "text-accent-purple",dot: "bg-accent-purple" },
  inactive: { label: "Inativo",   color: "text-muted",        dot: "bg-muted" },
}

const ROLE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:     { label: "Admin",      color: "text-accent-amber/80",  bg: "bg-accent-amber/5" },
  RH:        { label: "RH",         color: "text-accent-purple/80", bg: "bg-accent-purple/5" },
  DEVELOPER: { label: "DEV",        color: "text-accent-green/80",  bg: "bg-accent-green/5" },
  EMPLOYEE:  { label: "Colaborador", color: "text-muted/60",         bg: "bg-muted/5" },
  SUPER_ADMIN: { label: "DEV",      color: "text-accent-green/80",  bg: "bg-accent-green/5" },
}

const CONTRACT_LABEL: Record<string, string> = {
  CLT: "CLT", PJ: "PJ", ESTAGIO: "Estágio",
}

const DEPT_MAP: Record<string, string> = {
  desenvolvedor: "Tecnologia",
  developer: "Tecnologia",
  designer: "Design",
  financeiro: "Financeiro",
  rh: "Recursos Humanos",
  admin: "Administração",
  suporte: "Suporte",
  marketing: "Marketing",
  vendas: "Vendas",
  comercial: "Comercial",
  gerente: "Gestão",
  manager: "Gestão",
  diretor: "Diretoria",
  director: "Diretoria",
  estagiario: "Tecnologia",
  intern: "Tecnologia",
}

function inferDepartment(m: EnrichedMember): string {
  if (m.department) return m.department
  const pos = (m.position || "").toLowerCase()
  for (const [key, dept] of Object.entries(DEPT_MAP)) {
    if (pos.includes(key)) return dept
  }
  const role = m.role.toLowerCase()
  if (role === "developer") return "Tecnologia"
  if (role === "admin") return "Administração"
  if (role === "rh") return "Recursos Humanos"
  if (role === "employee") return "Operações"
  return "---"
}

function statusOf(m: EnrichedMember): StatusKey {
  if (!m.isActive) return "inactive"
  if (!m.todayClockIn) return m.pendingJustification ? "pending" : "offline"
  if (m.todayStatus === "ABSENCE") return "absent"
  if (m.todayStatus === "OVERTIME" || (m.todayTotalMinutes ?? 0) > 480) return "late"
  return "online"
}

function fmtMins(m: number | null | undefined): string {
  if (m == null) return "---"
  const h = Math.floor(m / 60); const r = Math.round(m % 60)
  return `${h}h${String(r).padStart(2, "0")}m`
}

function fmtBal(h: number): { t: string; neg: boolean } {
  const m = Math.round(Math.abs(h * 60))
  return { t: `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}m`, neg: h < 0 }
}

function fmtDate(s: string): string {
  if (!s) return ""
  return new Date(s).toLocaleDateString("pt-BR")
}

function fmtRel(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000); const h = Math.floor(d / 3600000); const dd = Math.floor(d / 86400000)
  if (m < 1) return "agora"
  if (m < 60) return `há ${m}min`
  if (h < 24) return `há ${h}h`
  if (dd === 1) return "ontem"
  if (dd < 7) return `há ${dd} dias`
  return fmtDate(iso)
}

function actIcon(a: string) {
  if (a.startsWith("CREATE")) return { icon: UserPlus, color: "text-accent-green" }
  if (a.startsWith("UPDATE")) return { icon: Edit3, color: "text-accent-purple" }
  if (a.startsWith("DEACTIVATE")) return { icon: Ban, color: "text-accent-red" }
  if (a.startsWith("DELETE")) return { icon: Trash2, color: "text-accent-red" }
  if (a.startsWith("RESET_PASSWORD")) return { icon: Key, color: "text-accent-amber" }
  if (a.startsWith("RESEND")) return { icon: Mail, color: "text-accent-purple" }
  if (a.startsWith("APPROVE")) return { icon: CheckCircle, color: "text-accent-green" }
  if (a.startsWith("REJECT")) return { icon: XCircle, color: "text-accent-red" }
  return { icon: Activity, color: "text-muted" }
}

export function EquipePage({ user, onViewProfile, allRecords = [], justificacoes = {} }: { user?: any; onViewProfile?: (id: string) => void; allRecords?: TimeRecord[]; justificacoes?: Record<string, Justificacao> }) {
  const [members, setMembers] = useState<EnrichedMember[]>([])
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [justifications, setJustifications] = useState<JustItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [pendingReviews, setPendingReviews] = useState<PendingReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"equipe" | "pendencias" | "atividades">("equipe")
  const [pendSubTab, setPendSubTab] = useState<"em_analise" | "aprovado" | "recusado">("em_analise")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("todas")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [showInactive, setShowInactive] = useState(false)
  const [sortOrder, setSortOrder] = useState<"az" | "za">("az")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [selMember, setSelMember] = useState<EnrichedMember | null>(null)
  const [selJust, setSelJust] = useState<JustItem | null>(null)
  const [selReview, setSelReview] = useState<PendingReviewItem | null>(null)
  const [justLoading, setJustLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<EnrichedMember | null>(null)
  const [rejectText, setRejectText] = useState("")
  const [permTab, setPermTab] = useState<"info" | "permissoes">("info")
  const [memberPerms, setMemberPerms] = useState<string[]>([])
  const [permSaving, setPermSaving] = useState(false)
  const [showNewMember, setShowNewMember] = useState(false)
  const [editingMember, setEditingMember] = useState(false)
  const [newMemberData, setNewMemberData] = useState({
    name: "", email: "", role: "EMPLOYEE", department: "", departmentId: "", position: "", positionId: "",
    contractType: "CLT", weeklyHours: 40, workSchedule: "Seg-Sex", hireDate: "", phone: "",
  })
  const [newMemberLoading, setNewMemberLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [newMemberRegNum, setNewMemberRegNum] = useState<string | null>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState("")
  const [_editDeptId, setEditDeptId] = useState("")
  const [editPositions, setEditPositions] = useState<any[]>([])

  const handleNewDeptChange = useCallback(async (deptId: string) => {
    setSelectedDeptId(deptId)
    setNewMemberData(p => ({ ...p, departmentId: deptId, positionId: "", position: "" }))
    if (deptId) {
      const list = await apiRef.positions(deptId)
      setPositions(list)
    } else {
      setPositions([])
    }
  }, [])

  const handleEditDeptChange = useCallback(async (deptId: string) => {
    setEditDeptId(deptId)
    if (deptId) {
      const list = await apiRef.positions(deptId)
      setEditPositions(list)
    } else {
      setEditPositions([])
    }
  }, [])

  const userCanAccess = canAccess(user, "access_team")
  const userCanManage = canAccess(user, "manage_members")
  const userCanApprove = canAccess(user, "approve_time_records")
  const userCanManagePerms = canAccess(user, "manage_permissions")
  const closeMenu = useCallback(() => setOpenMenuId(null), [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [closeMenu])

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError(null)
    const errors: string[] = []
    const calls: Promise<any>[] = [
      apiTeam.enriched().catch(() => { errors.push("equipe"); return [] }),
      apiTeam.metrics().catch(() => { errors.push("métricas"); return null }),
      apiJust.list().catch(() => { errors.push("justificativas"); return [] }),
      apiTeam.activityLogs().catch(() => { errors.push("atividades"); return [] }),
    ]
    if (userCanApprove) {
      calls.push(apiRecords.pendingReviews().catch(() => { errors.push("análises"); return [] }))
    }
    const [enr, met, just, act, rev] = await Promise.all(calls)
    if (Array.isArray(enr)) setMembers(enr)
    if (met) setMetrics(met)
    if (Array.isArray(just)) setJustifications(just)
    if (Array.isArray(act)) setActivities(act)
    if (rev && Array.isArray(rev)) setPendingReviews(rev)
    if (errors.length > 0) setError("Erro ao carregar: " + errors.join(", "))
    setLoading(false)
  }, [userCanApprove])

  useEffect(() => { fetchData(true) }, [fetchData])

  useEffect(() => {
    apiRef.departments().then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => fetchData(), 15000)
    return () => clearInterval(id)
  }, [fetchData])

  const membersWithLocalStats = useMemo(() => {
    if (!user?.id || !allRecords.length || !members.length) return members
    const monthBounds = getMonthBounds()
    const monthRecs = filterMonthRecords(allRecords, monthBounds)
    const stats = computeFilteredTotals(monthRecs, justificacoes)
    const saldo = computeSaldo(monthRecs, justificacoes)
    return members.map((m) =>
      m.id === user.id
        ? { ...m, monthTotalMinutes: stats.totalMins, balanceHours: saldo.netSaldo / 60 }
        : m
    )
  }, [members, user?.id, allRecords, justificacoes])

  const filtered = useMemo(() => {
    let list = membersWithLocalStats
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.position?.toLowerCase().includes(q)) ||
        inferDepartment(m).toLowerCase().includes(q)
      )
    }
    if (roleFilter !== "todas") list = list.filter(m => m.role === roleFilter)
    if (statusFilter !== "todos") list = list.filter(m => statusOf(m) === statusFilter)
    if (!showInactive) list = list.filter(m => m.isActive)
    list.sort((a, b) => sortOrder === "az" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
    return list
  }, [membersWithLocalStats, search, roleFilter, statusFilter, sortOrder, showInactive])

  const pendingJusts = useMemo(() => justifications.filter(j => j.status === "PENDING"), [justifications])
  const roles = useMemo(() => ["todas", ...new Set(membersWithLocalStats.map(m => m.role))], [membersWithLocalStats])

  const handleApprove = useCallback(async (id: string) => {
    setJustLoading(true)
    try {
      await apiJust.approve(id)
      const [just, enr] = await Promise.all([apiJust.list(), apiTeam.enriched()])
      if (Array.isArray(just)) setJustifications(just)
      if (Array.isArray(enr)) setMembers(enr)
      setSelJust(null)
    } catch {} finally { setJustLoading(false) }
  }, [])

  const handleReject = useCallback(async (id: string) => {
    setJustLoading(true)
    try {
      await apiJust.reject(id, rejectText || undefined)
      const [just, enr] = await Promise.all([apiJust.list(), apiTeam.enriched()])
      if (Array.isArray(just)) setJustifications(just)
      if (Array.isArray(enr)) setMembers(enr)
      setSelJust(null)
      setRejectText("")
    } catch {} finally { setJustLoading(false) }
  }, [rejectText])

  const handleReviewApprove = useCallback(async (id: string) => {
    setReviewLoading(true)
    try {
      await apiRecords.approve(id, reviewNote || undefined)
      const [rev] = await Promise.all([apiRecords.pendingReviews(), apiJust.list(), apiTeam.enriched()])
      if (Array.isArray(rev)) setPendingReviews(rev)
      setSelReview(null)
      setReviewNote("")
    } catch {} finally { setReviewLoading(false) }
  }, [reviewNote])

  const handleReviewReject = useCallback(async (id: string) => {
    setReviewLoading(true)
    try {
      await apiRecords.reject(id, reviewNote || undefined)
      const [rev] = await Promise.all([apiRecords.pendingReviews(), apiJust.list(), apiTeam.enriched()])
      if (Array.isArray(rev)) setPendingReviews(rev)
      setSelReview(null)
      setReviewNote("")
    } catch {} finally { setReviewLoading(false) }
  }, [reviewNote])

  const handleTogglePerm = useCallback(async (memberId: string, permKey: string) => {
    setPermSaving(true)
    try {
      const next = memberPerms.includes(permKey)
        ? memberPerms.filter(p => p !== permKey)
        : [...memberPerms, permKey]
      await apiTeam.updatePermissions(memberId, next)
      setMemberPerms(next)
    } catch (err: any) { alert(err?.message || "Erro ao salvar permissões") } finally { setPermSaving(false) }
  }, [memberPerms])

  const handleLoadPerms = useCallback(async (memberId: string) => {
    try {
      const data = await apiTeam.getPermissions(memberId)
      setMemberPerms(Array.isArray(data.permissions) ? data.permissions : [])
    } catch (err: any) {
      console.warn("Erro ao carregar permissões:", err?.message)
      setMemberPerms([])
    }
  }, [])

  const handleCreateMember = useCallback(async () => {
    setNewMemberLoading(true)
    try {
      const result = await apiTeam.create(newMemberData)
      setTempPassword(result.tempPassword)
      setNewMemberRegNum(result.user?.registrationNumber || null)
      await fetchData()
    } catch (err: any) {
      alert(err?.message || "Erro ao criar colaborador")
    } finally {
      setNewMemberLoading(false)
    }
  }, [newMemberData, fetchData])

  const handlePrintPDF = useCallback((m: EnrichedMember) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" })
    const pageW = 210
    let y = 20

    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("Perfil do Colaborador", pageW / 2, y, { align: "center" })
    y += 12

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageW / 2, y, { align: "center" })
    y += 12

    const fields = [
      ["Nome", m.name],
      ["Email", m.email],
      ["Matrícula", m.registrationNumber ? `CHR${m.registrationNumber}` : "---"],
      ["Cargo", user?.id === m.id ? (ROLE_STYLES[m.role]?.label || m.role) : "Colaborador"],
      ["Departamento", inferDepartment(m)],
      ["Função", m.position || "---"],
      ["Contrato", CONTRACT_LABEL[m.contractType ?? ""] || m.contractType || "---"],
      ["Carga horária", `${m.weeklyHours}h/sem`],
      ["Escala", m.workSchedule],
      ["Admissão", fmtDate(m.hireDate)],
      ["Status", m.isActive ? "Ativo" : "Inativo"],
      ["Código", m.employeeCode || "---"],
      ["Telefone", m.phone || "---"],
      ["Saldo do mês", fmtBal(m.balanceHours).t],
      ["Total no mês", fmtMins(m.monthTotalMinutes)],
    ]

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Informações", 14, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [["Campo", "Valor"]],
      body: fields,
      theme: "grid",
      headStyles: { fillColor: [98, 142, 203], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 1: { cellWidth: "auto" } },
      margin: { left: 14, right: 14 },
    })

    y = (doc as any).lastAutoTable.finalY + 15

    if (m.pendingJustification) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Justificativa pendente", 14, y)
      y += 7
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Motivo: ${m.pendingJustification.reason}`, 14, y)
      y += 5
      doc.text(`${fmtDate(m.pendingJustification.startDate)} → ${fmtDate(m.pendingJustification.endDate)}`, 14, y)
    }

    doc.save(`perfil-${m.name.toLowerCase().replace(/\s+/g, "-")}.pdf`)
  }, [])

  async function handleDeleteConfirm() {
    console.log("[delete] handleDeleteConfirm called, deleteTarget:", deleteTarget?.id)
    if (!deleteTarget) return
    setOpenMenuId(null)
    try {
      const res = await apiTeam.delete(deleteTarget.id)
      console.log("[delete] API response:", res)
      setDeleteTarget(null)
      await fetchData()
    } catch (err) {
      console.error("[delete] API error:", err)
    }
  }

  const handleAction = useCallback(async (action: string, member: EnrichedMember) => {
    setOpenMenuId(null)
    try {
      switch (action) {
        case "toggleActive":
          await apiTeam.updateStatus(member.id, !member.isActive)
          break
        case "resetPassword":
          const r = await apiTeam.resetPassword(member.id)
          alert(`Senha temporária: ${r.tempPassword}`)
          break
        case "delete":
          setDeleteTarget(member)
          return  // don't fetchData, modal will handle deletion
      }
      await fetchData()
    } catch {}
  }, [fetchData])

  const ACTIONS = (m: EnrichedMember) => [
    { key: "view", label: "Visualizar perfil", icon: Eye, onClick: () => onViewProfile?.(m.id) },
    { key: "divider1", divider: true },
    { key: "resetPassword", label: "Redefinir senha", icon: Key, onClick: () => handleAction("resetPassword", m) },
    { key: "divider2", divider: true },
    { key: "toggleActive", label: m.isActive ? "Desativar" : "Ativar", icon: m.isActive ? Ban : UserCheck, onClick: () => handleAction("toggleActive", m) },
    { key: "delete", label: "Excluir", icon: Trash2, onClick: () => handleAction("delete", m), danger: true },
  ]

  if (!userCanAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-2xl bg-accent-red/8 flex items-center justify-center mb-6">
          <Lock size={36} className="text-accent-red" />
        </div>
        <h2 className="text-xl font-bold text-primary mb-2">Acesso Restrito</h2>
        <p className="text-sm text-secondary max-w-md">
          Você não tem permissão para acessar esta área. Entre em contato com o RH ou administrador da empresa para solicitar acesso.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipe"
        subtitle={
          metrics
            ? `${metrics.total} colaboradores · ${metrics.presentToday} presentes hoje`
            : "Carregando..."
        }
        loading={loading}
        actions={
          <div className="flex items-center gap-2">
            {userCanManage && (
              <button onClick={() => setShowNewMember(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] text-[11px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
              >
                <UserPlus size={13} strokeWidth={2} />
                Novo Colaborador
              </button>
            )}
            <button onClick={() => fetchData(true)} disabled={loading}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-default/20 text-[11px] font-medium text-secondary hover:text-primary hover:bg-elevated/30 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw size={12} strokeWidth={2} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-red/8 border border-accent-red/20">
          <AlertTriangle size={14} className="text-accent-red shrink-0" />
          <p className="text-xs text-accent-red font-medium">{error}</p>
          <button onClick={() => fetchData(true)} className="ml-auto text-[10px] font-semibold text-accent-red hover:text-accent-red/80 underline">Tentar novamente</button>
        </div>
      )}

      {/* Metric cards */}
      {metrics && (
        <div className="flex flex-wrap items-stretch">
          {(() => {
            const cards = [
              { key: "total" as const, label: "Total de Colaboradores", icon: Users, value: metrics.total, color: "text-accent-purple/80", bg: "bg-accent-purple/5", trend: null as null | { dir: 'up' | 'down'; val: number } },
              { key: "hires" as const, label: "Admissões (mês)", icon: UserRoundPlus, value: metrics.hiresThisMonth, color: "text-accent-green/80", bg: "bg-accent-green/5", trend: { dir: metrics.hiresTrend, val: metrics.hiresThisMonth } },
              { key: "deactivations" as const, label: "Desligamentos (mês)", icon: UserRoundX, value: metrics.deactivationsThisMonth, color: "text-accent-red/80", bg: "bg-accent-red/5", trend: { dir: metrics.deactivationsTrend, val: metrics.deactivationsThisMonth } },
              { key: "presentToday" as const, label: "Presentes hoje", icon: Clock, value: metrics.presentToday, color: "text-accent-green/80", bg: "bg-accent-green/5", trend: null },
            ]
            return cards.map(c => {
              const Icon = c.icon
              return (
                <div key={c.key} className={`w-1/2 lg:w-1/4 flex flex-col gap-2 p-5 border-r border-default last:border-r-0 ${c.bg}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                      <Icon size={14} className={c.color} />
                    </div>
                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{c.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-primary">{c.value}</span>
                    {c.trend && (
                      <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                        c.trend.dir === 'up' ? 'text-accent-green' : c.trend.dir === 'down' ? 'text-accent-red' : 'text-muted'
                      }`}>
                        {c.trend.dir === 'up' ? <TrendingUp size={12} strokeWidth={2} /> : c.trend.dir === 'down' ? <TrendingDown size={12} strokeWidth={2} /> : null}
                        {c.trend.dir === 'stable' ? '—' : c.trend.dir === 'up' ? 'alta' : 'baixa'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-elevated/30 p-0.5">
          {(["equipe", "pendencias", "atividades"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`relative px-3.5 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                activeTab === t ? "bg-elevated/60 text-primary" : "text-muted hover:text-primary"
              }`}
            >
              {t === "equipe" ? "Equipe" : t === "pendencias" ? "Pendências" : "Atividades"}
              {t === "pendencias" && pendingJusts.length > 0 && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-accent-amber inline-block animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ EQUIPE TAB ═══ */}
      {activeTab === "equipe" && (
        <div className="flex flex-col gap-4">
          {/* Search + filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" strokeWidth={2} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, email, cargo..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-default/20 bg-input text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200"
              />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-default/20 bg-input text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]"
            >
              {roles.map(r => (
                <option key={r} value={r} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{r === "todas" ? "Cargo" : ROLE_STYLES[r]?.label || r}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-default/20 bg-input text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]"
            >
              <option value="todos" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Status</option>
              {(["online","late","absent","offline","pending","inactive"] as StatusKey[]).map(k => (
                <option key={k} value={k} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{STATUS_CFG[k].label}</option>
              ))}
            </select>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "az" | "za")}
              className="h-9 px-2.5 rounded-lg border border-default/20 bg-input text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]"
            >
              <option value="az" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">A → Z</option>
              <option value="za" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Z → A</option>
            </select>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`h-9 px-3 rounded-lg border text-[11px] font-semibold transition-all duration-200 ${
                showInactive
                  ? "border-accent-red/30 bg-accent-red/8 text-accent-red"
                  : "border-default/20 bg-input text-muted hover:text-primary"
              }`}
            >
              {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
            </button>
            <span className="text-[11px] text-muted whitespace-nowrap">{filtered.length} de {members.length}</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 py-4 border-b border-default last:border-b-0 first:border-t border-default">
                  <div className="w-9 h-9 rounded-full bg-elevated/20 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 rounded bg-elevated/20 animate-pulse" />
                    <div className="h-3 w-32 rounded bg-elevated/20 animate-pulse" />
                  </div>
                  <div className="h-6 w-20 rounded bg-elevated/20 animate-pulse" />
                  <div className="h-6 w-24 rounded bg-elevated/20 animate-pulse" />
                  <div className="h-6 w-16 rounded bg-elevated/20 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Members list */}
          {!loading && (
            <div className="flex flex-col">
              {filtered.map((m, idx) => {
                const st = statusOf(m)
                const sc = STATUS_CFG[st]
                const rb = user?.id === m.id ? (ROLE_STYLES[m.role] ?? ROLE_STYLES.EMPLOYEE) : ROLE_STYLES.EMPLOYEE
                const dept = inferDepartment(m)
                return (
                  <div key={m.id}
                    className={`group relative flex items-center gap-4 px-4 py-3.5 border-b border-default last:border-b-0 hover:bg-elevated/10 transition-all duration-200 cursor-pointer ${idx === 0 ? "border-t border-default" : ""}`}
                    onClick={() => onViewProfile?.(m.id)}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-elevated/40 flex items-center justify-center">
                          <Users size={15} className="text-muted" />
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${sc.dot}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_120px_80px_110px] gap-2 sm:gap-4 items-start sm:items-center">
                      {/* Name column */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary truncate">{m.name}</span>
                          {m.registrationNumber ? <span className="text-[9px] font-mono text-muted">CHR{m.registrationNumber}</span> : <span className="text-[9px] font-mono text-muted/40">---</span>}
                          {m.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse shrink-0" />}
                          {!m.isActive && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-accent-red/10 text-accent-red uppercase tracking-wider shrink-0">Inativo</span>}
                          {m.pendingJustification && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber uppercase tracking-wider shrink-0">Justif.</span>}
                        </div>
                        <p className="text-[11px] text-secondary truncate mt-0.5">{m.position || m.email}</p>
                      </div>

                      {/* Role + Dept */}
                      <div className="min-w-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rb.color} ${rb.bg} inline-block`}>{rb.label}</span>
                        <p className="text-[10px] text-muted mt-0.5 truncate">{dept}</p>
                      </div>

                      {/* Contract */}
                      <div className="min-w-0">
                        <span className="text-[11px] text-primary font-medium">{CONTRACT_LABEL[m.contractType ?? ""] || m.contractType || "---"}</span>
                        <p className="text-[9px] text-muted mt-0.5">{m.weeklyHours}h/sem</p>
                      </div>

                      {/* Status + Today */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          <span className={`text-[11px] font-semibold ${sc.color}`}>{sc.label}</span>
                        </div>
                        {m.todayClockIn ? (
                          <p className="text-[9px] text-muted mt-0.5">{m.todayClockIn} → {m.todayClockOut || "---"}</p>
                        ) : (
                          <p className="text-[9px] text-muted mt-0.5">sem registro</p>
                        )}
                      </div>

                    </div>

                    {/* Actions */}
                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal size={14} strokeWidth={2} />
                      </button>
                      {openMenuId === m.id && (
                        <div ref={menuRef} className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl bg-surface border border-default/30 shadow-modal py-1 animate-in fade-in duration-150">
                          {ACTIONS(m).map((a: any) =>
                            a.divider ? (
                              <div key={a.key} className="h-px bg-default/20 my-1" />
                            ) : (
                              <button key={a.key} onClick={a.onClick}
                                className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-[11px] font-medium transition-all duration-150 ${
                                  a.danger ? "text-accent-red hover:bg-accent-red/8" : "text-secondary hover:text-primary hover:bg-elevated"
                                }`}
                              >
                                <a.icon size={13} strokeWidth={1.5} />
                                {a.label}
                              </button>
                            )
                          )}
                </div>
              )}
            </div>
                  </div>
                )
              })}

              {filtered.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
                    <Users size={28} className="text-muted" />
                  </div>
                  <p className="text-base font-semibold text-primary">
                    {members.length === 0 ? "Nenhum colaborador" : "Nenhum resultado"}
                  </p>
                  <p className="text-sm text-secondary mt-1.5 max-w-xs">
                    {members.length === 0
                      ? "Cadastre colaboradores para começar."
                      : "Tente ajustar a busca ou filtros."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ PENDÊNCIAS TAB ═══ */}
      {activeTab === "pendencias" && (
        <div className="flex flex-col gap-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2">
            {(["em_analise", "aprovado", "recusado"] as const).map(st => {
              const dots: Record<string, { color: string; bg: string }> = {
                em_analise: { color: "bg-accent-amber", bg: "bg-accent-amber/10" },
                aprovado: { color: "bg-accent-green", bg: "bg-accent-green/10" },
                recusado: { color: "bg-accent-red", bg: "bg-accent-red/10" },
              }
              return (
                <button key={st} onClick={() => setPendSubTab(st)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                    pendSubTab === st ? `${dots[st].bg} text-primary` : "text-muted hover:text-primary"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dots[st].color}`} />
                  {st === "em_analise" ? "Em análise" : st === "aprovado" ? "Aprovado" : "Recusado"}
                </button>
              )
            })}
          </div>

          {/* Em análise: pending justifications + pending reviews */}
          {pendSubTab === "em_analise" && (
            <div className="flex flex-col gap-2">
              {pendingJusts.length === 0 && pendingReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
                    <ShieldCheck size={28} className="text-muted" />
                  </div>
                  <p className="text-base font-semibold text-primary">Nada pendente</p>
                  <p className="text-sm text-secondary mt-1.5 max-w-xs">Justificativas e registros em análise aparecerão aqui.</p>
                </div>
              ) : (
                <>
                  {pendingJusts.length > 0 && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Justificativas</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
                    </div>
                  )}
                  {pendingJusts.map(j => (
                    <div key={j.id} onClick={() => { setSelJust(j); setRejectText("") }}
                      className="flex items-center gap-4 p-4 rounded-xl border border-accent-amber/20 hover:border-accent-amber/30 transition-all duration-200 cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-accent-amber/10 flex items-center justify-center shrink-0">
                        <FileText size={15} className="text-accent-amber" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-primary">{j.user?.name || "Colaborador"}</span>
                          {j.user?.department && <span className="text-[10px] text-muted hidden sm:inline">{j.user.department}</span>}
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber uppercase tracking-wider">
                            <span className="w-1 h-1 rounded-full bg-accent-amber animate-pulse" />
                            Pendente
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-secondary">{j.reason}</span>
                          <span className="text-[9px] text-muted">·</span>
                          <span className="text-[11px] text-muted">{fmtDate(j.startDate)} → {fmtDate(j.endDate)}</span>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); handleApprove(j.id) }} disabled={justLoading}
                          className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green hover:bg-accent-green/20 transition-all duration-200 disabled:opacity-50"
                        ><CheckCircle size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setSelJust(j); setRejectText("") }}
                          className="w-8 h-8 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red hover:bg-accent-red/20 transition-all duration-200"
                        ><XCircle size={14} /></button>
                      </div>
                      <span className="text-[10px] text-muted shrink-0 hidden sm:block">{fmtRel(j.createdAt)}</span>
                      <ExternalLink size={13} className="text-muted opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0" />
                    </div>
                  ))}

                  {pendingReviews.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 mb-1">
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Registros de ponto</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
                    </div>
                  )}
                  {pendingReviews.map(r => (
                    <div key={r.id} onClick={() => setSelReview(r)}
                      className="flex items-center gap-4 p-4 rounded-xl border border-accent-amber/20 hover:border-accent-amber/30 transition-all duration-200 cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-accent-amber/10 flex items-center justify-center shrink-0">
                        <Clock size={15} className="text-accent-amber" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-primary">{r.user?.name || "Colaborador"}</span>
                          {r.user?.department && <span className="text-[10px] text-muted hidden sm:inline">{r.user.department}</span>}
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber uppercase tracking-wider">
                            <span className="w-1 h-1 rounded-full bg-accent-amber animate-pulse" />
                            Pendente
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-secondary">
                            {r.date?.substring?.(0, 10) ? new Date(r.date.substring(0, 10)).toLocaleDateString("pt-BR") : r.date}
                          </span>
                          <span className="text-[9px] text-muted">·</span>
                          <span className="text-[11px] text-muted">{r.clockIn} → {r.clockOut || "---"}</span>
                          {r.totalMinutes != null && (
                            <>
                              <span className="text-[9px] text-muted">·</span>
                              <span className="text-[11px] text-muted">{fmtMins(r.totalMinutes)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); handleReviewApprove(r.id) }} disabled={reviewLoading}
                          className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center text-accent-green hover:bg-accent-green/20 transition-all duration-200 disabled:opacity-50"
                          title="Aprovar"
                        ><ThumbsUp size={13} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setSelReview(r); setReviewNote("") }}
                          className="w-8 h-8 rounded-lg bg-accent-red/10 flex items-center justify-center text-accent-red hover:bg-accent-red/20 transition-all duration-200"
                          title="Recusar"
                        ><ThumbsDown size={13} /></button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Aprovado */}
          {pendSubTab === "aprovado" && (
            <div className="flex flex-col gap-2">
              {justifications.filter(j => j.status === "APPROVED").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
                    <CheckCircle size={28} className="text-accent-green" />
                  </div>
                  <p className="text-base font-semibold text-primary">Nenhuma aprovada</p>
                  <p className="text-sm text-secondary mt-1.5 max-w-xs">Justificativas aprovadas aparecerão aqui.</p>
                </div>
              ) : (
                justifications.filter(j => j.status === "APPROVED").map((j, ji) => (
                  <div key={j.id} className={`flex items-center gap-3 py-3 ${ji > 0 ? "border-t border-default/5" : ""}`}>
                    <div className="w-8 h-8 rounded-lg bg-accent-green/8 flex items-center justify-center shrink-0">
                      <CheckCircle size={14} className="text-accent-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-primary">{j.user?.name || "Colaborador"}</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green uppercase tracking-wider">
                          <span className="w-1 h-1 rounded-full bg-accent-green" />
                          Aprovado
                        </span>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{j.reason} · {fmtDate(j.startDate)} → {fmtDate(j.endDate)}</p>
                    </div>
                    <span className="text-[10px] text-muted shrink-0">{fmtRel(j.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Recusado */}
          {pendSubTab === "recusado" && (
            <div className="flex flex-col gap-2">
              {justifications.filter(j => j.status === "REJECTED").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
                    <XCircle size={28} className="text-accent-red" />
                  </div>
                  <p className="text-base font-semibold text-primary">Nenhuma recusada</p>
                  <p className="text-sm text-secondary mt-1.5 max-w-xs">Justificativas recusadas aparecerão aqui.</p>
                </div>
              ) : (
                justifications.filter(j => j.status === "REJECTED").map((j, ji) => (
                  <div key={j.id} className={`flex items-center gap-3 py-3 ${ji > 0 ? "border-t border-default/5" : ""}`}>
                    <div className="w-8 h-8 rounded-lg bg-accent-red/8 flex items-center justify-center shrink-0">
                      <XCircle size={14} className="text-accent-red" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-primary">{j.user?.name || "Colaborador"}</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-red/10 text-accent-red uppercase tracking-wider">
                          <span className="w-1 h-1 rounded-full bg-accent-red" />
                          Recusado
                        </span>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{j.reason} · {fmtDate(j.startDate)} → {fmtDate(j.endDate)}</p>
                      {j.rhResponse && <p className="text-[9px] text-accent-red/70 mt-0.5 italic">"{j.rhResponse}"</p>}
                    </div>
                    <span className="text-[10px] text-muted shrink-0">{fmtRel(j.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ ATIVIDADES TAB ═══ */}
      {activeTab === "atividades" && (
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-elevated/20 animate-pulse border-b border-default last:border-b-0 first:border-t border-default" />)}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-elevated/30 flex items-center justify-center mb-5">
                <Activity size={28} className="text-muted" />
              </div>
              <p className="text-base font-semibold text-primary">Nenhuma atividade</p>
              <p className="text-sm text-secondary mt-1.5 max-w-xs">Ações administrativas aparecerão aqui em tempo real.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {activities.map((a) => {
                const ai = actIcon(a.action)
                const AIcon = ai.icon
                return (
                  <div key={a.id} className="relative flex items-start gap-3 py-3 border-b border-default last:border-b-0">
                    <div className="w-9 h-9 rounded-lg bg-elevated/30 flex items-center justify-center shrink-0">
                      <AIcon size={14} className={ai.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">{a.user?.name || "Sistema"}</span>
                        <span className="text-[10px] text-muted">{a.action.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                      {a.description && (
                        <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">{a.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {a.targetUser && <span className="text-[10px] text-accent-purple font-medium">{a.targetUser.name}</span>}
                        <span className="text-[9px] text-muted">{fmtRel(a.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ NEW MEMBER MODAL ═══ */}
      {showNewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!tempPassword) { setShowNewMember(false); setTempPassword(null) } }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                  <UserPlus size={16} className="text-accent-blue" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">
                    {tempPassword ? "Colaborador criado" : "Novo Colaborador"}
                  </h3>
                  <p className="text-xs text-secondary">
                    {tempPassword ? "Senha temporária gerada" : "Preencha os dados do novo colaborador"}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowNewMember(false); setTempPassword(null); setNewMemberRegNum(null); setNewMemberData({ name: "", email: "", role: "EMPLOYEE", department: "", departmentId: "", position: "", positionId: "", contractType: "CLT", weeklyHours: 40, workSchedule: "Seg-Sex", hireDate: "", phone: "" }); setSelectedDeptId(""); setPositions([]) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {tempPassword ? (
              <div className="p-5 space-y-4">
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-accent-green/10 flex items-center justify-center mb-4">
                    <CheckCircle size={24} className="text-accent-green" />
                  </div>
                  <p className="text-sm font-semibold text-primary mb-1">Colaborador cadastrado com sucesso!</p>
                  <p className="text-xs text-secondary mb-5">Compartilhe a senha temporária com o colaborador.</p>
                  <div className="w-full p-4 rounded-xl bg-accent-amber/5 border border-accent-amber/20 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Senha temporária</p>
                    <p className="text-lg font-mono font-bold text-accent-amber tracking-wider">{tempPassword}</p>
                  </div>
                  {newMemberRegNum && (
                    <div className="w-full p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/20 mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">Matrícula</p>
                      <p className="text-base font-mono font-bold text-accent-blue tracking-wider">CHR{newMemberRegNum}</p>
                    </div>
                  )}
                  <button onClick={() => { setShowNewMember(false); setTempPassword(null); setNewMemberRegNum(null); setNewMemberData({ name: "", email: "", role: "EMPLOYEE", department: "", departmentId: "", position: "", positionId: "", contractType: "CLT", weeklyHours: 40, workSchedule: "Seg-Sex", hireDate: "", phone: "" }); setSelectedDeptId(""); setPositions([]) }}
                    className="w-full h-10 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                  >Fechar</button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateMember() }} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Nome *</label>
                    <input required value={newMemberData.name} onChange={e => setNewMemberData(p => ({ ...p, name: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Email *</label>
                    <input required type="email" value={newMemberData.email} onChange={e => setNewMemberData(p => ({ ...p, email: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Matrícula</label>
                    <input disabled value="Gerada automaticamente"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-muted placeholder:text-muted opacity-60 cursor-not-allowed" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Contrato</label>
                    <select value={newMemberData.contractType} onChange={e => setNewMemberData(p => ({ ...p, contractType: e.target.value }))}
                      className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]">
                      <option value="CLT" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">CLT</option>
                      <option value="PJ" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">PJ</option>
                      <option value="ESTAGIO" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Estágio</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Departamento</label>
                    <select value={selectedDeptId} onChange={e => handleNewDeptChange(e.target.value)}
                      className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]">
                      <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Selecione</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Função</label>
                    <select value={newMemberData.positionId} onChange={e => setNewMemberData(p => ({ ...p, positionId: e.target.value }))}
                      className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]" disabled={!selectedDeptId}>
                      <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Selecione</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Carga horária (h/sem)</label>
                    <input type="number" value={newMemberData.weeklyHours} onChange={e => setNewMemberData(p => ({ ...p, weeklyHours: Number(e.target.value) }))}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Escala</label>
                    <input value={newMemberData.workSchedule} onChange={e => setNewMemberData(p => ({ ...p, workSchedule: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Admissão</label>
                    <input type="date" value={newMemberData.hireDate} onChange={e => setNewMemberData(p => ({ ...p, hireDate: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Telefone</label>
                    <input value={newMemberData.phone} onChange={e => setNewMemberData(p => ({ ...p, phone: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => { setShowNewMember(false); setTempPassword(null); setNewMemberRegNum(null); setNewMemberData({ name: "", email: "", role: "EMPLOYEE", department: "", departmentId: "", position: "", positionId: "", contractType: "CLT", weeklyHours: 40, workSchedule: "Seg-Sex", hireDate: "", phone: "" }); setSelectedDeptId(""); setPositions([]) }}
                    className="flex-1 h-10 rounded-lg bg-surface border border-default/50 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
                  >Cancelar</button>
                  <button type="submit" disabled={newMemberLoading || !newMemberData.name || !newMemberData.email}
                    className="flex-1 h-10 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {newMemberLoading ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={14} />}
                    {newMemberLoading ? "Criando..." : "Criar Colaborador"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══ MEMBER DETAIL MODAL ═══ */}
      {selMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setSelMember(null); setOpenMenuId(null) }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  {selMember.avatar ? (
                    <img src={selMember.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-elevated/40 flex items-center justify-center">
                      <Users size={20} className="text-muted" />
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${STATUS_CFG[statusOf(selMember)].dot}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-primary">{selMember.name}</h3>
                    {selMember.isOnline && <span className="flex items-center gap-1 text-[10px] text-accent-green font-medium"><Wifi size={10} />online</span>}
                  </div>
                    <p className="text-xs text-secondary mt-0.5">{selMember.position || selMember.role} · {inferDepartment(selMember)}</p>
                    <p className="text-[11px] font-mono text-muted mt-1">Matrícula: {selMember.registrationNumber ? `CHR${selMember.registrationNumber}` : "---"}</p>
                </div>
              </div>
              <button onClick={() => setSelMember(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Tab toggle */}
            {userCanManagePerms && (
              <div className="flex items-center gap-1 px-5 pt-4">
                <button onClick={() => setPermTab("info")}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    permTab === "info" ? "bg-elevated text-primary" : "text-muted hover:text-primary"
                  }`}>Informações</button>
                {["DEVELOPER", "SUPER_ADMIN"].includes(user?.role || "") && (
                  <button onClick={() => { setPermTab("permissoes"); handleLoadPerms(selMember.id) }}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                      permTab === "permissoes" ? "bg-elevated text-primary" : "text-muted hover:text-primary"
                    }`}>Permissões</button>
                )}
              </div>
            )}

            <div className="p-5 space-y-5">
              {permTab === "info" ? (
                <>
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Email", value: selMember.email },
                      { label: "Cargo", value: user?.id === selMember.id ? (ROLE_STYLES[selMember.role]?.label || selMember.role) : "Colaborador" },
                      { label: "Departamento", value: inferDepartment(selMember) },
                      { label: "Função", value: selMember.position || "---" },
                      { label: "Contrato", value: CONTRACT_LABEL[selMember.contractType ?? ""] || selMember.contractType || "---" },
                      { label: "Carga horária", value: `${selMember.weeklyHours}h/sem` },
                      { label: "Escala", value: selMember.workSchedule },
                      { label: "Admissão", value: fmtDate(selMember.hireDate) },
                      { label: "Status", value: selMember.isActive ? "Ativo" : "Inativo" },
                      { label: "Matrícula", value: selMember.registrationNumber ? `CHR${selMember.registrationNumber}` : "---" },
                      { label: "Saldo do mês", value: fmtBal(selMember.balanceHours).t, balance: true },
                      { label: "Total no mês", value: fmtMins(selMember.monthTotalMinutes) },
                    ].map(item => (
                      <div key={item.label} className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">{item.label}</span>
                        <span className={`text-xs font-medium truncate ${(item as any).balance ? (selMember.balanceHours >= 0 ? "text-accent-green" : "text-accent-red") : "text-primary"}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pending justification */}
                  {selMember.pendingJustification && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">Justificativa pendente</h4>
                      <div className="p-4 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
                        <div className="flex items-center gap-2 mb-1.5">
                          <AlertTriangle size={14} className="text-accent-amber shrink-0" />
                          <span className="text-xs font-semibold text-accent-amber">{selMember.pendingJustification.reason}</span>
                        </div>
                        <p className="text-[11px] text-secondary ml-6">{fmtDate(selMember.pendingJustification.startDate)} → {fmtDate(selMember.pendingJustification.endDate)}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {userCanManage && (
                    <div className="flex items-center gap-2 pt-3 border-t border-default/10">
                      <button onClick={async () => { setEditingMember(true); const deptId = selMember.departmentId || ""; setEditDeptId(deptId); if (deptId) { const list = await apiRef.positions(deptId); setEditPositions(list) } else { setEditPositions([]) } }}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold text-accent-blue hover:bg-accent-blue/8 transition-all duration-200 border border-default/10"
                      ><Edit3 size={12} strokeWidth={2} /> Editar</button>
                      <button onClick={() => handlePrintPDF(selMember)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold text-secondary hover:text-primary hover:bg-elevated transition-all duration-200 border border-default/10"
                      ><FileText size={12} strokeWidth={2} /> Imprimir PDF</button>
                      <button onClick={() => handleAction("resetPassword", selMember)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold text-accent-amber hover:bg-accent-amber/8 transition-all duration-200 border border-default/10"
                      ><Key size={12} strokeWidth={2} /> Resetar senha</button>
                      <button onClick={() => handleAction("toggleActive", selMember)}
                        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold transition-all duration-200 border border-default/10 ${
                          selMember.isActive ? "text-accent-red hover:bg-accent-red/8" : "text-accent-green hover:bg-accent-green/8"
                        }`}
                      >{selMember.isActive ? <Ban size={12} strokeWidth={2} /> : <UserCheck size={12} strokeWidth={2} />}
                        {selMember.isActive ? "Desativar" : "Ativar"}</button>
                    </div>
                  )}
                </>
              ) : ["DEVELOPER", "SUPER_ADMIN"].includes(user?.role || "") ? (
                /* ═══ PERMISSIONS TAB ═══ */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-secondary font-medium uppercase tracking-wider">
                      Permissões adicionais para <strong className="text-primary">{selMember.name}</strong>
                    </p>
                    {permSaving && <Loader2 size={12} className="animate-spin text-accent-purple" />}
                  </div>
                  <p className="text-[10px] text-muted">
                    As permissões do cargo ({ROLE_STYLES[selMember.role]?.label || selMember.role}) são aplicadas automaticamente. Marque abaixo permissões adicionais.
                  </p>
                  <div className="flex flex-col gap-2">
                    {ALL_PERMISSIONS.map((p) => {
                      const enabled = memberPerms.includes(p.key)
                      return (
                        <label key={p.key} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-elevated/20 hover:bg-elevated/30 transition-all duration-200 cursor-pointer">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${enabled ? "bg-accent-blue border-accent-blue" : "border-default/40"}`}>
                            {enabled && <CheckCircle size={11} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-primary">{p.label}</span>
                            <span className="text-[9px] text-muted ml-2">({p.group})</span>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); handleTogglePerm(selMember.id, p.key) }}
                            disabled={permSaving}
                            className="text-[9px] font-semibold text-accent-blue hover:text-accent-blue/80 disabled:opacity-50"
                          >
                            {enabled ? "Remover" : "Adicionar"}
                          </button>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MEMBER MODAL ═══ */}
      {editingMember && selMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingMember(false)}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                  <Edit3 size={16} className="text-accent-purple" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">Editar {selMember.name}</h3>
                  <p className="text-xs text-secondary">Atualize as informações do colaborador</p>
                </div>
              </div>
              <button onClick={() => setEditingMember(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              try {
                const deptId = fd.get("departmentId") as string || null
                const posId = fd.get("positionId") as string || null
                await apiTeam.update(selMember.id, {
                  name: fd.get("name") as string,
                  role: fd.get("role") as string,
                  departmentId: deptId,
                  positionId: posId,
                  contractType: fd.get("contractType") as string,
                  weeklyHours: Number(fd.get("weeklyHours")),
                  workSchedule: fd.get("workSchedule") as string,
                  phone: fd.get("phone") as string || null,
                })
                setEditingMember(false)
                await fetchData()
                setSelMember(null)
              } catch (err: any) { alert(err?.message || "Erro ao atualizar") }
            }} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Nome</label>
                  <input name="name" defaultValue={selMember.name} required
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                </div>
                {["DEVELOPER", "SUPER_ADMIN"].includes(user?.role || "") ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Cargo</label>
                  <select name="role" defaultValue={selMember.role}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]">
                    {Object.entries(ROLE_STYLES).map(([k, v]) => (
                      <option key={k} value={k} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{v.label}</option>
                    ))}
                  </select>
                </div>
                ) : (
                  <input type="hidden" name="role" value={selMember.role} />
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Contrato</label>
                  <select name="contractType" defaultValue={selMember.contractType || "CLT"}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]">
                    <option value="CLT" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">CLT</option>
                    <option value="PJ" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">PJ</option>
                    <option value="ESTAGIO" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Estágio</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Departamento</label>
                  <select name="departmentId" defaultValue={selMember.departmentId || ""} onChange={e => handleEditDeptChange(e.target.value)}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]">
                    <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">--</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Função</label>
                  <select name="positionId" defaultValue={selMember.positionId || ""}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default/30 text-[11px] text-primary focus:outline-none focus:border-[var(--accent-ring)]">
                    <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">--</option>
                    {editPositions.map(p => (
                      <option key={p.id} value={p.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Carga (h/sem)</label>
                  <input name="weeklyHours" type="number" defaultValue={selMember.weeklyHours}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Escala</label>
                  <input name="workSchedule" defaultValue={selMember.workSchedule}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Telefone</label>
                  <input name="phone" defaultValue={selMember.phone || ""}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-ring)] transition-all duration-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Matrícula</label>
                  <input disabled value={selMember.registrationNumber ? `CHR${selMember.registrationNumber}` : "Gerada automaticamente"}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default/30 text-xs text-muted placeholder:text-muted opacity-60 cursor-not-allowed" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setEditingMember(false)}
                  className="flex-1 h-10 rounded-lg bg-surface border border-default/50 text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
                >Cancelar</button>
                <button type="submit"
                  className="flex-1 h-10 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                >Salvar alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ JUSTIFICATION MODAL ═══ */}
      {selJust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setSelJust(null); setRejectText("") }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-amber/10 flex items-center justify-center">
                  <FileText size={16} className="text-accent-amber" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">{selJust.user?.name || "Colaborador"}</h3>
                  <p className="text-xs text-secondary">{selJust.reason}</p>
                </div>
              </div>
              <button onClick={() => { setSelJust(null); setRejectText("") }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Início</span>
                  <span className="text-xs font-medium text-primary">{fmtDate(selJust.startDate)}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Fim</span>
                  <span className="text-xs font-medium text-primary">{fmtDate(selJust.endDate)}</span>
                </div>
              </div>

              {selJust.description && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Descrição</span>
                  <p className="text-xs text-secondary leading-relaxed">{selJust.description}</p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1.5">Motivo da recusa (opcional)</label>
                <textarea value={rejectText} onChange={e => setRejectText(e.target.value)}
                  placeholder="Descreva o motivo da recusa..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-elevated/30 border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent-blue resize-none transition-all duration-200"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => handleApprove(selJust.id)} disabled={justLoading}
                  className="flex items-center gap-2 flex-1 h-10 justify-center rounded-lg bg-accent-green text-white text-[11px] font-semibold hover:bg-accent-green/90 disabled:opacity-50 transition-all duration-200"
                >
                  {justLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={14} />}
                  Aprovar
                </button>
                <button onClick={() => handleReject(selJust.id)} disabled={justLoading}
                  className="flex items-center gap-2 flex-1 h-10 justify-center rounded-lg bg-accent-red text-white text-[11px] font-semibold hover:bg-accent-red/90 disabled:opacity-50 transition-all duration-200"
                >
                  {justLoading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
                  Recusar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REVIEW APPROVAL MODAL ═══ */}
      {selReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setSelReview(null); setReviewNote("") }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default/30 shadow-modal"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between p-5 border-b border-default/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-amber/10 flex items-center justify-center">
                  <Clock size={16} className="text-accent-amber" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary">{selReview.user?.name || "Colaborador"}</h3>
                  <p className="text-xs text-secondary">
                    {selReview.date?.substring?.(0, 10) ? new Date(selReview.date.substring(0, 10)).toLocaleDateString("pt-BR") : selReview.date}
                  </p>
                </div>
              </div>
              <button onClick={() => { setSelReview(null); setReviewNote("") }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Entrada</span>
                  <span className="text-xs font-medium text-primary">{selReview.clockIn}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Saída</span>
                  <span className="text-xs font-medium text-primary">{selReview.clockOut || "---"}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Pausa</span>
                  <span className="text-xs font-medium text-primary">{selReview.breakStart ? `${selReview.breakStart} → ${selReview.breakEnd || "---"}` : "Sem pausa"}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-elevated/20">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Total</span>
                  <span className="text-xs font-medium text-primary">{fmtMins(selReview.totalMinutes)}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1.5">Observação (opcional)</label>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  placeholder="Adicione uma observação sobre esta análise..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-elevated/30 border border-default/30 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent-blue resize-none transition-all duration-200"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => handleReviewApprove(selReview.id)} disabled={reviewLoading}
                  className="flex items-center gap-2 flex-1 h-10 justify-center rounded-lg bg-accent-green text-white text-[11px] font-semibold hover:bg-accent-green/90 disabled:opacity-50 transition-all duration-200"
                >
                  {reviewLoading ? <Loader2 size={13} className="animate-spin" /> : <ThumbsUp size={13} />}
                  Aprovar
                </button>
                <button onClick={() => handleReviewReject(selReview.id)} disabled={reviewLoading}
                  className="flex items-center gap-2 flex-1 h-10 justify-center rounded-lg bg-accent-red text-white text-[11px] font-semibold hover:bg-accent-red/90 disabled:opacity-50 transition-all duration-200"
                >
                  {reviewLoading ? <Loader2 size={13} className="animate-spin" /> : <ThumbsDown size={13} />}
                  Recusar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm mx-4 bg-surface border border-default/10 shadow-modal rounded-xl p-5 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setDeleteTarget(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/50 transition-all duration-200"
            >
              <X size={16} strokeWidth={2} />
            </button>

            <div className="flex flex-col gap-1 mb-5">
              <h2 className="text-lg font-bold text-primary tracking-tight">Excluir colaborador</h2>
              <p className="text-sm text-secondary">
                Tem certeza que deseja excluir permanentemente <strong className="text-primary">{deleteTarget.name}</strong>?
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-accent-red/8 mb-5">
              <AlertTriangle size={14} className="text-accent-red shrink-0" strokeWidth={2} />
              <span className="text-[11px] text-accent-red font-medium">Esta ação não pode ser desfeita.</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-lg bg-elevated text-sm font-medium text-secondary hover:text-primary transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 h-11 rounded-lg bg-accent-red text-sm font-semibold text-white hover:bg-accent-red/80 transition-all duration-200"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
