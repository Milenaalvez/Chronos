import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  ArrowLeft, Mail, Clock, Calendar,
  ShieldCheck, FileText, Printer,
  CheckCircle, XCircle, Ban, Edit3, Loader2, Lock, Users,
  History, UserX, UserPlus,
  Play, LogIn, Key, Power, TrendingUp, AlertTriangle, Camera,
} from "lucide-react"
import { team as apiTeam, reference as apiRef, documents as apiDocs, auth as apiAuth, uploadAvatar, faceRegistration as apiFace } from "../services/api"
import { canAccess, ALL_PERMISSIONS } from "../utils/permissions"
import { formatMinutes } from "../types"
import { computeFilteredTotals, computeSaldo, getMonthBounds, filterMonthRecords } from "../services/workHoursEngine"
import type { TimeRecord, Justificacao } from "../types"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { FaceRegistrationModal } from "../componentes/FaceRegistrationModal"

interface ProfileData {
  id: string; name: string; email: string; role: string
  department: string | null; departmentId: string | null
  position: string | null; positionId: string | null
  contractType: string | null; phone: string | null
  avatar: string | null; employeeCode: string | null
  registrationNumber: string | null
  weeklyHours: number; workSchedule: string
  hireDate: string; birthDate: string | null; address: string | null
  isActive: boolean; emailVerified: boolean
  permissions: any; companyId: string; createdAt: string
  stats: {
    monthTotalMinutes: number; balanceHours: number
    extraMinutes: number; lateDays: number; absenceDays: number
    monthWorkedDays: number
  }
  today: {
    clockIn: string | null; clockOut: string | null
    breakStart: string | null; breakEnd: string | null
    totalMinutes: number | null; status: string | null
  } | null
  justifications: any[]
  activityLogs: {
    id: string; action: string; description: string | null
    entityType: string | null; entityId: string | null
    metadata: any; timestamp: string
    user: { id: string; name: string; avatar: string | null; role: string }
  }[]
  firstAccess: string; lastAccess: string | null
  memberCount: number
  _documents?: any[]
}

const ROLE_STYLES: Record<string, { label: string }> = {
  ADMIN:     { label: "Admin" },
  RH:        { label: "RH" },
  DEVELOPER: { label: "DEV" },
  EMPLOYEE:  { label: "Membro" },
}

const CONTRACT_LABEL: Record<string, string> = {
  CLT: "CLT", PJ: "PJ", ESTAGIO: "Estágio",
}

const ACTION_ICONS: Record<string, any> = {
  CREATE_MEMBER: UserPlus, UPDATE_MEMBER: Edit3, DELETE_MEMBER: UserX,
  DEACTIVATE_MEMBER: Ban, RESET_PASSWORD: Key, UPDATE_PERMISSIONS: ShieldCheck,
  RESEND_VERIFICATION: Mail, LOGIN: LogIn, PASSWORD_CHANGED: Key,
  TIMERECORD_CREATE: Play, TIMERECORD_UPDATE: Edit3, TIMERECORD_CLOCK_IN: Play, TIMERECORD_CLOCK_OUT: LogIn,
  TIMERECORD_BREAK_START: Clock, TIMERECORD_BREAK_END: Clock,
  JUSTIFICATION_CREATE: FileText, JUSTIFICATION_APPROVE: CheckCircle, JUSTIFICATION_REJECT: XCircle,
  APPROVE_TIME_RECORD: CheckCircle, REJECT_TIME_RECORD: XCircle,
  DOCUMENT_CREATE: FileText, DOCUMENT_DELETE: Ban,
  ACCOUNT_CREATED: UserPlus, EMAIL_VERIFIED: ShieldCheck, PASSWORD_RESET_REQUESTED: Key,
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_MEMBER: "Conta criada", UPDATE_MEMBER: "Perfil atualizado",
  DELETE_MEMBER: "Colaborador removido", DEACTIVATE_MEMBER: "Conta desativada",
  RESET_PASSWORD: "Senha redefinida", UPDATE_PERMISSIONS: "Permissões alteradas",
  RESEND_VERIFICATION: "Verificação reenviada", LOGIN: "Login efetuado",
  PASSWORD_CHANGED: "Senha alterada",
  TIMERECORD_CREATE: "Registro de jornada", TIMERECORD_UPDATE: "Registro alterado",
  TIMERECORD_CLOCK_IN: "Entrada registrada", TIMERECORD_CLOCK_OUT: "Saída registrada",
  TIMERECORD_BREAK_START: "Início de intervalo", TIMERECORD_BREAK_END: "Retorno de intervalo",
  JUSTIFICATION_CREATE: "Justificativa enviada", JUSTIFICATION_APPROVE: "Justificativa aprovada",
  JUSTIFICATION_REJECT: "Justificativa recusada",
  APPROVE_TIME_RECORD: "Registro aprovado", REJECT_TIME_RECORD: "Registro recusado",
  DOCUMENT_CREATE: "Documento enviado", DOCUMENT_DELETE: "Documento removido",
  ACCOUNT_CREATED: "Primeiro acesso realizado", EMAIL_VERIFIED: "E-mail verificado",
  PASSWORD_RESET_REQUESTED: "Recuperação de senha solicitada",
}

function safeDate(raw: unknown): Date | null {
  if (!raw) return null
  if (raw instanceof Date) return raw
  const s = String(raw).substring(0, 10)
  if (!s || s.length < 10) return null
  const d = new Date(s + "T12:00:00")
  if (isNaN(d.getTime())) return null
  return d
}

function fmtDate(raw: unknown): string {
  const d = safeDate(raw)
  if (!d) return "---"
  return d.toLocaleDateString("pt-BR")
}

function fmtDateTime(raw: unknown): string {
  if (!raw) return "Nunca"
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return "---"
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}


function deptLabel(m: { department?: string | null; position?: string | null }): string {
  return m.department || m.position || "---"
}

interface PerfilPageProps {
  memberId: string
  user: any
  onBack: () => void
  onNavigate?: (page: string) => void
  embedded?: boolean
  onAvatarUpdate?: (url: string) => void
  allRecords?: TimeRecord[]
  justificacoes?: Record<string, Justificacao>
}

export function PerfilPage({ memberId, user, onBack, onNavigate, embedded, onAvatarUpdate, allRecords = [], justificacoes = {} }: PerfilPageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("informacoes")
  const [timelineFilter, setTimelineFilter] = useState("all")
  const [memberPerms, setMemberPerms] = useState<string[]>([])
  const [permSaving, setPermSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [_editDeptId, setEditDeptId] = useState("")
  const [editPositions, setEditPositions] = useState<any[]>([])
  const [selfEditNome, setSelfEditNome] = useState("")
  const [selfEditCargo, setSelfEditCargo] = useState("")
  const [selfEditPhone, setSelfEditPhone] = useState("")
  const [selfEditEmail, setSelfEditEmail] = useState("")
  const [selfEditNasc, setSelfEditNasc] = useState("")
  const [selfEditEndereco, setSelfEditEndereco] = useState("")
  const [selfEditMode, setSelfEditMode] = useState(false)
  const [selfSaving, setSelfSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null)
  const [faceLoading, setFaceLoading] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userCanManage = canAccess(user, "manage_members")
  const userCanManagePerms = canAccess(user, "manage_permissions")
  const userIsRhOrAdmin = canAccess(user, "switch_accounts") || user.role === "RH" || user.role === "ADMIN" || user.role === "DEVELOPER"

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiTeam.getProfile(memberId),
      apiDocs.list(memberId).catch(() => []),
    ])
      .then(([profileData, docs]) => {
        setProfile({ ...profileData, _documents: docs })
        setMemberPerms(Array.isArray(profileData.permissions) ? profileData.permissions : [])
      })
      .catch((err) => setError(err?.message || "Erro ao carregar perfil"))
      .finally(() => setLoading(false))
  }, [memberId])

  const handleTogglePerm = useCallback(async (permKey: string) => {
    setPermSaving(true)
    try {
      const next = memberPerms.includes(permKey)
        ? memberPerms.filter(p => p !== permKey)
        : [...memberPerms, permKey]
      await apiTeam.updatePermissions(memberId, next)
      setMemberPerms(next)
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar permissões")
    } finally {
      setPermSaving(false)
    }
  }, [memberId, memberPerms])

  const handleResetPassword = useCallback(async () => {
    if (!confirm("Redefinir senha do colaborador?")) return
    setActionLoading("reset")
    try {
      const r = await apiTeam.resetPassword(memberId)
      alert(`Senha temporária: ${r.tempPassword}`)
    } catch (err: any) {
      alert(err?.message || "Erro ao redefinir senha")
    } finally {
      setActionLoading(null)
    }
  }, [memberId])

  useEffect(() => {
    apiRef.departments().then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    setFaceLoading(true)
    apiFace.status()
      .then((res) => setFaceRegistered(res.registered))
      .catch(() => setFaceRegistered(false))
      .finally(() => setFaceLoading(false))
  }, [memberId])

  const handleEditDeptChange = useCallback(async (deptId: string) => {
    setEditDeptId(deptId)
    if (deptId) {
      const list = await apiRef.positions(deptId)
      setEditPositions(list)
    } else {
      setEditPositions([])
    }
  }, [])

  const handleEditSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profile) return
    const fd = new FormData(e.currentTarget)
    try {
      const deptId = fd.get("departmentId") as string || null
      const posId = fd.get("positionId") as string || null
      await apiTeam.update(profile.id, {
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
      const data = await apiTeam.getProfile(memberId)
      setProfile(data)
      setMemberPerms(Array.isArray(data.permissions) ? data.permissions : [])
    } catch (err: any) {
      alert(err?.message || "Erro ao atualizar")
    }
  }, [profile, memberId])

  const handleSelfEdit = useCallback(() => {
    if (!profile) return
    setSelfEditNome(profile.name)
    setSelfEditCargo(profile.position || "")
    setSelfEditPhone(profile.phone || "")
    setSelfEditEmail(profile.email)
    setSelfEditNasc(profile.birthDate ? profile.birthDate.substring(0, 10) : "")
    setSelfEditEndereco(profile.address || "")
  }, [profile])

  const handleSelfSave = useCallback(async () => {
    setSelfSaving(true)
    try {
      await apiAuth.updateProfile({
        name: selfEditNome,
        position: selfEditCargo,
        phone: selfEditPhone,
        email: selfEditEmail,
        birthDate: selfEditNasc || null,
        address: selfEditEndereco || null,
      })
      const data = await apiTeam.getProfile(memberId)
      setProfile(data)
      setSelfEditMode(false)
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar perfil")
    } finally {
      setSelfSaving(false)
    }
  }, [selfEditNome, selfEditCargo, selfEditPhone, selfEditEmail, selfEditNasc, selfEditEndereco, memberId])

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2MB.")
      return
    }
    setAvatarUploading(true)
    try {
      const result = await uploadAvatar(file)
      setProfile((prev) => prev ? { ...prev, avatar: result.avatarUrl } : prev)
      setAvatarVersion((v) => v + 1)
      onAvatarUpdate?.(result.avatarUrl)
    } catch {
      alert("Erro ao enviar imagem.")
    } finally {
      setAvatarUploading(false)
    }
  }, [memberId])

  const handleToggleActive = useCallback(async () => {
    if (!profile) return
    const action = profile.isActive ? "desativar" : "ativar"
    if (!confirm(`Tem certeza que deseja ${action} este colaborador?`)) return
    setActionLoading("toggle")
    try {
      await apiTeam.updateStatus(memberId, !profile.isActive)
      setProfile({ ...profile, isActive: !profile.isActive })
    } catch (err: any) {
      alert(err?.message || `Erro ao ${action} colaborador`)
    } finally {
      setActionLoading(null)
    }
  }, [memberId, profile])

  const handlePrintPDF = useCallback(() => {
    if (!profile) return
    const p = profile
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

    const s = p.stats
    const balMins = Math.round(Math.abs(s.balanceHours * 60))
    const balVal = `${s.balanceHours >= 0 ? "+" : "-"}${formatMinutes(balMins)}`
    const totalVal = formatMinutes(Math.round(s.monthTotalMinutes))

    const fields = [
      ["Nome", p.name],
      ["Email", p.email],
      ["Matrícula", p.registrationNumber ? `CHR${p.registrationNumber}` : "---"],
      ["Departamento", deptLabel(p)],
      ["Função", p.position || "---"],
      ["Contrato", CONTRACT_LABEL[p.contractType ?? ""] || p.contractType || "---"],
      ["Carga horária", `${p.weeklyHours}h/sem`],
      ["Escala", p.workSchedule],
      ["Admissão", fmtDate(p.hireDate)],
      ["Status", p.isActive ? "Ativo" : "Inativo"],
      ["Telefone", p.phone || "---"],
      ["Saldo do mês", balVal],
      ["Total no mês", totalVal],
      ["Horas extras", formatMinutes(Math.round(s.extraMinutes))],
      ["Faltas", String(s.absenceDays)],
      ["Atrasos", String(s.lateDays)],
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

    doc.save(`perfil-${p.name.toLowerCase().replace(/\s+/g, "-")}.pdf`)
  }, [profile])

  const isNew = useMemo(() => profile ? profile.memberCount <= 1 : true, [profile])

  const localStats = useMemo(() => {
    if (!allRecords.length) return null
    const monthBounds = getMonthBounds()
    const monthRecs = filterMonthRecords(allRecords, monthBounds)
    return computeFilteredTotals(monthRecs)
  }, [allRecords])

  const localSaldo = useMemo(() => {
    if (!allRecords.length) return null
    const monthBounds = getMonthBounds()
    const monthRecs = filterMonthRecords(allRecords, monthBounds)
    return computeSaldo(monthRecs, justificacoes)
  }, [allRecords, justificacoes])

  const stats = useMemo(() => {
    if (!profile) return null
    const isOwnProfile = memberId === user?.id && localStats && localSaldo
    if (isOwnProfile) {
      const total = formatMinutes(Math.round(localStats.totalMins))
      const extra = formatMinutes(Math.round(localStats.extraMins))
      const bal = localSaldo.netSaldo / 60
      const balMins = Math.round(Math.abs(bal * 60))
      const balVal = isNew ? "00h00" : `${bal >= 0 ? "+" : "-"}${formatMinutes(balMins)}`
      const faltas = isNew ? "0" : "0"
      const atrasos = isNew ? "0" : "0"
      return { total, extra, balVal, faltas, atrasos, bal, hasAbsence: false, hasLate: false }
    }
    const s = profile.stats
    const total = formatMinutes(Math.round(s.monthTotalMinutes))
    const extra = formatMinutes(Math.round(s.extraMinutes))
    const bal = s.balanceHours
    const balMins = Math.round(Math.abs(bal * 60))
    const balVal = isNew ? "00h00" : `${bal >= 0 ? "+" : "-"}${formatMinutes(balMins)}`
    const faltas = isNew ? "0" : String(s.absenceDays)
    const atrasos = isNew ? "0" : String(s.lateDays)
    return { total, extra, balVal, faltas, atrasos, bal, hasAbsence: s.absenceDays > 0, hasLate: s.lateDays > 0 }
  }, [profile, isNew, memberId, user?.id, localStats, localSaldo])

  const timeline = useMemo(() => {
    if (!profile) return []
    const items: { date: string; icon: any; label: string; desc: string; color: string; action: string; ts: string }[] = []

    for (const log of profile.activityLogs) {
      const Icon = ACTION_ICONS[log.action] || Edit3
      items.push({
        date: log.timestamp,
        icon: Icon,
        label: ACTION_LABELS[log.action] || log.action,
        desc: log.description || "",
        color: "text-[var(--accent-primary)]",
        action: log.action,
        ts: log.timestamp,
      })
    }

    for (const j of profile.justifications) {
      const st = j.status === "APPROVED" ? "aprovada" : j.status === "REJECTED" ? "recusada" : "enviada"
      const Icon = j.status === "APPROVED" ? CheckCircle : j.status === "REJECTED" ? XCircle : Clock
      const color = j.status === "APPROVED" ? "text-[#5B9B7A]" : j.status === "REJECTED" ? "text-[#C96B6B]" : "text-[#C49A6B]"
      items.push({
        date: j.createdAt || j.startDate,
        icon: Icon,
        label: `Justificativa ${st}`,
        desc: `${j.reason} (${fmtDate(j.startDate)} → ${fmtDate(j.endDate)})`,
        color,
        action: "justification",
        ts: j.createdAt || j.startDate,
      })
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return items.slice(0, 50)
  }, [profile])

  const filteredTimeline = useMemo(() => {
    if (timelineFilter === "all") return timeline
    return timeline.filter((item) => item.action === timelineFilter)
  }, [timeline, timelineFilter])

  const timelineActions = useMemo(() => {
    const seen = new Set<string>()
    seen.add("all")
    const actions: { value: string; label: string }[] = [{ value: "all", label: "Todos os eventos" }]
    for (const item of timeline) {
      if (!seen.has(item.action)) {
        seen.add(item.action)
        const label = ACTION_LABELS[item.action] || item.action
        actions.push({ value: item.action, label })
      }
    }
    return actions
  }, [timeline])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={22} className="animate-spin text-[var(--accent-primary)]" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
        <Lock size={32} className="text-accent-red" />
        <h2 className="text-lg font-bold text-primary">Erro ao carregar perfil</h2>
        <p className="text-sm text-secondary">{error || "Perfil não encontrado"}</p>
        <button onClick={onBack} className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-white">
          Voltar
        </button>
      </div>
    )
  }

  const p = profile
  const roleLabel = ROLE_STYLES[p.role]?.label || "Membro"

  return (
    <div className={`${embedded ? "w-full" : "w-full px-4 sm:px-6 lg:px-8"} pb-16 animate-in fade-in duration-300`}>

      {/* ═══════════════ TOPO ═══════════════ */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] text-muted hover:text-primary transition-colors">
              <ArrowLeft size={13} strokeWidth={2} />
              Voltar
            </button>
            <span className="text-[11px] text-muted">/</span>
            <button onClick={() => { onNavigate?.("equipe"); onBack() }} className="text-[11px] text-muted hover:text-primary transition-colors">Colaboradores</button>
            <span className="text-[11px] text-muted">/</span>
            <span className="text-[11px] text-primary font-medium">{p.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {userCanManage && (
              <button
                onClick={async () => {
                  const deptId = profile?.departmentId || ""
                  setEditDeptId(deptId)
                  if (deptId) {
                    const list = await apiRef.positions(deptId)
                    setEditPositions(list)
                  } else {
                    setEditPositions([])
                  }
                  setEditingMember(true)
                }}
                className="h-8 px-3.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-secondary hover:text-primary flex items-center gap-1.5 transition-all"
              >
                <Edit3 size={13} />
                Editar colaborador
              </button>
            )}
            <button
              onClick={handlePrintPDF}
              className="h-8 px-3.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-secondary hover:text-primary flex items-center gap-1.5 transition-all"
            >
              <Printer size={13} />
              Imprimir PDF
            </button>
            {(userCanManage || userIsRhOrAdmin) && (
              <>
                <button
                  onClick={handleResetPassword}
                  disabled={actionLoading === "reset"}
                  className="h-8 px-3.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-secondary hover:text-primary flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Key size={13} />
                  {actionLoading === "reset" ? "..." : "Redefinir senha"}
                </button>
                <button
                  onClick={handleToggleActive}
                  disabled={actionLoading === "toggle"}
                  className="h-8 px-3.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-secondary hover:text-primary flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Power size={13} className={p.isActive ? "text-accent-red" : "text-accent-green"} />
                  {actionLoading === "toggle" ? "..." : p.isActive ? "Desativar" : "Ativar"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ CABEÇALHO ═══════════════ */}
      <div className="flex pb-6 border-b border-default">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0 group">
              {p.avatar ? (
                <img src={`${p.avatar}?t=${avatarVersion}`} alt="" className="w-[140px] h-[140px] rounded-xl object-cover" />
              ) : (
                <div className="w-[140px] h-[140px] rounded-xl bg-white/[0.04] flex items-center justify-center">
                  <Users size={40} className="text-muted" />
                </div>
              )}
              {embedded && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 w-full h-full rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    {avatarUploading ? (
                      <Loader2 size={20} className="text-white animate-spin" />
                    ) : (
                      <Camera size={24} className="text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </>
              )}
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-app bg-[#5B9B7A]" />
            </div>

            <div className="min-w-0 pt-1">
              <div className="flex items-center gap-2.5 mb-2">
                <h1 className="text-xl font-bold text-primary">{p.name}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  p.isActive ? "bg-[#5B9B7A]/10 text-[#5B9B7A]" : "bg-[#C96B6B]/10 text-[#C96B6B]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? "bg-[#5B9B7A]" : "bg-[#C96B6B]"}`} />
                  {p.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>

              <p className="text-[12px] text-secondary font-mono mb-4">
                Matrícula: <span className="text-[var(--accent-primary)] font-semibold">{p.registrationNumber ? `CHR${p.registrationNumber}` : "---"}</span>
              </p>

              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">Função</p>
                  <p className="text-[13px] font-medium text-primary">{p.position || "---"}</p>
                </div>
                <div className="w-px h-8 bg-white/[0.08]" />
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">Departamento</p>
                  <p className="text-[13px] font-medium text-primary">{deptLabel(p)}</p>
                </div>
                <div className="w-px h-8 bg-white/[0.08]" />
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">Admissão</p>
                  <p className="text-[13px] font-medium text-primary">{fmtDate(p.hireDate)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 pl-8 ml-8 border-l border-default flex flex-col justify-center gap-4 min-w-[200px]">
          <div className="flex items-center gap-3">
            <Clock size={14} className="text-muted shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Último acesso</p>
              <p className="text-[13px] font-medium text-primary">{fmtDateTime(p.lastAccess)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={14} className="text-muted shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Primeiro acesso</p>
              <p className="text-[13px] font-medium text-primary">{fmtDateTime(p.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-muted shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">E-mail</p>
              <p className="text-[13px] font-medium text-primary truncate">{p.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ INDICADORES ═══════════════ */}
      {stats && (
        <div className="flex items-stretch gap-0 py-5 border-b border-default">
          {[
            { icon: Clock, label: "Saldo do mês", value: stats.balVal, desc: "Horas balanceadas", color: isNew ? "text-muted" : stats.bal >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]" },
            { icon: Calendar, label: "Total de horas", value: stats.total, desc: "Horas trabalhadas", color: "text-primary" },
            { icon: TrendingUp, label: "Horas extras", value: stats.extra, desc: "Horas extras realizadas", color: isNew ? "text-muted" : "text-[#C49A6B]" },
            { icon: XCircle, label: "Faltas", value: stats.faltas, desc: "Dias de falta", color: isNew ? "text-muted" : stats.hasAbsence ? "text-[#C96B6B]" : "text-[#5B9B7A]" },
            { icon: AlertTriangle, label: "Atrasos", value: stats.atrasos, desc: "Atrasos registrados", color: isNew ? "text-muted" : stats.hasLate ? "text-[#C49A6B]" : "text-[#5B9B7A]" },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div key={item.label} className={`flex-1 flex flex-col gap-1.5 ${i > 0 ? "pl-6 ml-6 border-l border-default" : ""}`}>
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-muted" />
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{item.label}</span>
                </div>
                <span className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</span>
                <span className="text-[11px] text-secondary">{item.desc}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════ ÁREA PRINCIPAL (2 colunas) ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-7">

        {/* ═══ COLUNA ESQUERDA ═══ */}
        <div className="min-w-0">

          {/* ── Abas ── */}
          <div className="flex items-center gap-6 border-b border-default">
            {[
              { key: "informacoes", label: "Informações" },
              { key: "contrato", label: "Contrato" },
              { key: "documentos", label: "Documentos" },
              ...(userIsRhOrAdmin ? [{ key: "permissoes", label: "Permissões" }] : []),
              { key: "historico", label: "Histórico" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-[12px] font-medium transition-all duration-200 border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "text-primary border-[var(--accent-primary)]"
                    : "text-muted hover:text-secondary border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Informações ── */}
          {activeTab === "informacoes" && (
            <div className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                <Section title="Informações Pessoais">
                  {embedded && selfEditMode ? (
                    <>
                      <div className="flex flex-col gap-1.5 mb-3">
                        <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Nome</label>
                        <input
                          value={selfEditNome}
                          onChange={(e) => setSelfEditNome(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[13px] text-primary outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 mb-3">
                        <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">E-mail</label>
                        <input
                          value={selfEditEmail}
                          onChange={(e) => setSelfEditEmail(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[13px] text-primary outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 mb-3">
                        <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Telefone</label>
                        <input
                          value={selfEditPhone}
                          onChange={(e) => setSelfEditPhone(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[13px] text-primary outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 mb-3">
                        <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Data de Nascimento</label>
                        <input
                          type="date"
                          value={selfEditNasc}
                          onChange={(e) => setSelfEditNasc(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[13px] text-primary outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 mb-3">
                        <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Endereço</label>
                        <input
                          value={selfEditEndereco}
                          onChange={(e) => setSelfEditEndereco(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[13px] text-primary outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={handleSelfSave}
                          disabled={selfSaving}
                          className="h-8 px-4 rounded-lg bg-[var(--accent-primary)] text-[11px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {selfSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                          Salvar
                        </button>
                        <button
                          onClick={() => setSelfEditMode(false)}
                          className="h-8 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-secondary hover:text-primary transition-all duration-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="Nome" value={p.name} />
                      <Field label="E-mail" value={p.email} />
                      <Field label="Telefone" value={p.phone || "---"} />
                      <Field label="Data de Nascimento" value={p.birthDate ? fmtDate(p.birthDate) : "---"} />
                      <Field label="Endereço" value={p.address || "---"} />
                      {embedded && !selfEditMode && (
                        <button
                          onClick={() => { handleSelfEdit(); setSelfEditMode(true) }}
                          className="h-7 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-medium text-secondary hover:text-primary flex items-center gap-1.5 transition-all mt-1"
                        >
                          <Edit3 size={11} />
                          Editar informações
                        </button>
                      )}
                    </>
                  )}
                </Section>
                <Section title="Informações Corporativas">
                  <Field label="Contrato" value={CONTRACT_LABEL[p.contractType ?? ""] || p.contractType || "---"} />
                  <Field label="Carga horária" value={`${p.weeklyHours}h/sem`} />
                  <Field label="Escala" value={p.workSchedule} />
                  <Field label="Status" value={p.isActive ? "Ativo" : "Inativo"} />
                </Section>
                <Section title="Dados do Sistema">
                  <Field label="Data de admissão" value={fmtDate(p.hireDate)} />
                  <Field label="Matrícula" value={p.registrationNumber ? `CHR${p.registrationNumber}` : "---"} />
                  <Field label="E-mail verificado" value={p.emailVerified ? "Sim" : "Não"} />
                  <Field label="Empresa" value={p.companyId ? "---" : "---"} />
                </Section>
              </div>

              <div className="mt-6">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-4">Reconhecimento Facial</h3>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-elevated/15">
                  {faceLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Loader2 size={14} className="animate-spin" />
                      Verificando...
                    </div>
                  ) : faceRegistered ? (
                    <>
                      <Camera size={18} className="text-[#5B9B7A] shrink-0" />
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-primary">Face cadastrada</span>
                          <span className="text-[11px] text-secondary">Identidade facial registrada</span>
                        </div>
                        <button onClick={() => setShowFaceModal(true)} className="h-7 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-medium text-secondary hover:text-primary transition-all duration-200 shrink-0">
                          Re cadastrar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={18} className="text-[#D94A4A] shrink-0" />
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-primary">Face não cadastrada</span>
                          <span className="text-[11px] text-secondary">Registre sua identidade facial</span>
                        </div>
                        <button onClick={() => setShowFaceModal(true)} className="h-7 px-3 rounded-lg bg-[var(--accent-primary)] text-[10px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 shrink-0">
                          Cadastrar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Card de aviso de admissão */}
              {!isNew && (
                <div className="mt-4 p-4 border border-accent-amber/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-accent-amber mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[12px] text-accent-amber font-medium">Período de experiência</p>
                      <p className="text-[11px] text-secondary mt-1 leading-relaxed">
                        Períodos anteriores à admissão não são considerados nos cálculos.
                        <br />
                        Período ignorado: anterior a <strong className="text-primary">{fmtDate(p.hireDate)}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Permissões ── */}
          {activeTab === "permissoes" && (
            <div className="mt-6 max-w-xl">
              <p className="text-[13px] text-secondary mb-5">
                Permissões base do cargo <strong className="text-primary">{roleLabel}</strong> são aplicadas automaticamente.
                {userCanManagePerms && " Marque abaixo as permissões adicionais."}
              </p>
              <div className="flex flex-col gap-1">
                {ALL_PERMISSIONS.map((perm) => {
                  const enabled = memberPerms.includes(perm.key)
                  return (
                    <div key={perm.key} className="flex items-center gap-3 py-2.5 px-1">
                      <div
                        onClick={() => userCanManagePerms && handleTogglePerm(perm.key)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${
                          enabled ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]" : "border-white/20 hover:border-white/40"
                        } ${userCanManagePerms ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {enabled && <CheckCircle size={11} className="text-white" />}
                      </div>
                      <span className="text-[13px] text-primary flex-1">{perm.label}</span>
                      <span className="text-[10px] text-muted">{perm.group}</span>
                      {userCanManagePerms && (
                        <button
                          onClick={() => handleTogglePerm(perm.key)}
                          disabled={permSaving}
                          className="text-[11px] font-medium text-[var(--accent-primary)] hover:opacity-70 disabled:opacity-40"
                        >
                          {permSaving ? "..." : enabled ? "Remover" : "Adicionar"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Tab: Documentos ── */}
          {activeTab === "documentos" && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[13px] text-secondary">Documentos organizados do colaborador.</p>
                {userCanManage && (
                  <label className="h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] text-[11px] font-semibold text-white flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all">
                    <FileText size={12} />
                    Enviar documento
                    <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const name = prompt("Nome do documento:") || file.name
                        const type = prompt("Tipo (ex: RG, CPF, Contrato):") || ""
                        const category = prompt("Categoria (pessoal, trabalhista, interno):") || "pessoal"
                        if (!type || !category) return alert("Tipo e categoria são obrigatórios")
                        try {
                          await apiDocs.upload(file, { userId: memberId, name, type, category })
                          const data = await apiTeam.getProfile(memberId)
                          setProfile(data)
                        } catch (err: any) {
                          alert(err?.message || "Erro ao enviar documento")
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-8">
                {[
                  { key: "pessoal", title: "Documentos Pessoais", docs: ["RG", "CPF", "CNH", "Comprovante de residência", "Certidão de nascimento", "Certidão de casamento"] },
                  { key: "trabalhista", title: "Documentos Trabalhistas", docs: ["Carteira de Trabalho (CTPS)", "Contrato de trabalho", "Termo de confidencialidade", "Termo de responsabilidade", "Exames admissionais", "Exames periódicos", "Exames demissionais", "Ficha de registro do colaborador"] },
                  { key: "interno", title: "Documentos Internos", docs: ["Advertências", "Declarações", "Certificados", "Comprovantes de treinamento", "Avaliações de desempenho", "Outros anexos"] },
                ].map((cat) => {
                  const catDocs = (profile as any)?._documents?.filter((d: any) => d.category === cat.key) || []
                  return (
                    <div key={cat.key}>
                      <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-3">{cat.title}</h3>
                      <div className="grid grid-cols-1 gap-1">
                        {cat.docs.map((docName) => {
                          const uploaded = catDocs.find((d: any) => d.name === docName || d.type === docName)
                          return (
                            <div key={docName} className="flex items-center justify-between py-2.5 border-b border-default last:border-b-0">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <FileText size={13} className={uploaded ? "text-[var(--accent-primary)]" : "text-muted"} />
                                <span className="text-[12px] text-primary truncate">{docName}</span>
                                {uploaded && (
                                  <span className="text-[9px] text-muted bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">Enviado</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                {uploaded ? (
                                  <>
                                    <a href={uploaded.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] font-medium text-[var(--accent-primary)] hover:opacity-70 transition-opacity">
                                      Download
                                    </a>
                                    <button onClick={() => window.open(uploaded.fileUrl, '_blank')}
                                      className="text-[10px] font-medium text-secondary hover:text-primary transition-colors">
                                      Visualizar
                                    </button>
                                    {userCanManage && (
                                      <button onClick={async () => {
                                        if (!confirm(`Remover ${docName}?`)) return
                                        try {
                                          await apiDocs.delete(uploaded.id, memberId)
                                          const data = await apiTeam.getProfile(memberId)
                                          setProfile(data)
                                        } catch { alert("Erro ao remover documento") }
                                      }}
                                        className="text-[10px] font-medium text-accent-red/70 hover:text-accent-red transition-colors">
                                        Excluir
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] text-muted">Nenhum</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Tab: Histórico ── */}
          {activeTab === "historico" && (
            <div className="mt-6 max-w-2xl">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center gap-3">
                  <History size={22} className="text-muted" />
                  <p className="text-sm text-secondary">Nenhum registro de atividade.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[13px] top-2 bottom-2 w-px bg-white/[0.06]" />
                  <div className="flex flex-col">
                    {filteredTimeline.map((item, i) => {
                      const Icon = item.icon
                      return (
                        <div key={i} className="flex items-start gap-4 py-2.5">
                          <div className={`w-[26px] flex items-center justify-center z-10 ${item.color}`}>
                            <Icon size={12} strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-primary">{item.label}</p>
                            {item.desc && <p className="text-[11px] text-secondary mt-0.5">{item.desc}</p>}
                            <p className="text-[10px] text-muted mt-0.5">{fmtDateTime(item.ts)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Contrato ── */}
          {activeTab === "contrato" && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
              <Section title="Vínculo">
                <Field label="Tipo de contrato" value={CONTRACT_LABEL[p.contractType ?? ""] || p.contractType || "---"} />
                <Field label="Carga horária semanal" value={`${p.weeklyHours}h`} />
                <Field label="Escala de trabalho" value={p.workSchedule} />
              </Section>
              <Section title="Alocação">
                <Field label="Departamento" value={deptLabel(p)} />
                <Field label="Função" value={p.position || "---"} />
                <Field label="Data de admissão" value={fmtDate(p.hireDate)} />
              </Section>
              <Section title="Documentos">
                <Field label="Matrícula" value={p.registrationNumber ? `CHR${p.registrationNumber}` : "---"} />
                <Field label="Contrato" value={CONTRACT_LABEL[p.contractType ?? ""] || p.contractType || "---"} />
                <Field label="Status" value={p.isActive ? "Ativo" : "Inativo"} />
              </Section>
            </div>
          )}

        </div>

        {/* ═══ COLUNA DIREITA ═══ */}
        <div className="min-w-0">

          {/* ── Logs de Atividades ── */}
          <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider mb-3">Logs de Atividades</h3>

          <div className="relative mb-4">
            <select
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value)}
              className="w-full h-8 px-3 text-[11px] bg-white/[0.04] border border-default rounded-lg text-secondary focus:outline-none focus:border-[var(--accent-primary)] appearance-none cursor-pointer"
            >
              {timelineActions.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredTimeline.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center gap-2">
                <History size={16} className="text-muted" />
                <p className="text-[11px] text-muted">Nenhum evento encontrado.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-white/[0.06]" />
                <div className="flex flex-col">
                  {filteredTimeline.slice(0, 30).map((item, i) => {
                    const Icon = item.icon
                    return (
                      <div key={i} className="flex items-start gap-3 py-2">
                        <div className={`w-[26px] flex items-center justify-center z-10 ${item.color}`}>
                          <Icon size={11} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-primary leading-tight">{item.label}</p>
                          <p className="text-[9px] text-muted mt-0.5">{fmtDateTime(item.ts)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      {editingMember && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingMember(false)}>
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-default shadow-modal"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-default">
              <div>
                <h3 className="text-base font-bold text-primary">Editar {profile.name}</h3>
                <p className="text-xs text-secondary mt-0.5">Atualize as informações do colaborador</p>
              </div>
              <button onClick={() => setEditingMember(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/[0.04] transition-all">
                <XCircle size={16} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Nome</label>
                  <input name="name" defaultValue={profile.name} required
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-primary)] transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Cargo</label>
                  <select name="role" defaultValue={profile.role}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default text-[11px] text-primary focus:outline-none focus:border-[var(--accent-primary)]">
                    {Object.entries(ROLE_STYLES).map(([k, v]) => (
                      <option key={k} value={k} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{v.label}</option>
                    ))}
                   </select>
                 </div>
                 <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Contrato</label>
                   <select name="contractType" defaultValue={profile.contractType || "CLT"}
                     className="h-9 px-2.5 rounded-lg bg-input border border-default text-[11px] text-primary focus:outline-none focus:border-[var(--accent-primary)]">
                     <option value="CLT" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">CLT</option>
                     <option value="PJ" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">PJ</option>
                     <option value="ESTAGIO" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">Estágio</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Departamento</label>
                  <select name="departmentId" defaultValue={profile.departmentId || ""} onChange={e => handleEditDeptChange(e.target.value)}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default text-[11px] text-primary focus:outline-none focus:border-[var(--accent-primary)]">
                    <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">--</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Função</label>
                  <select name="positionId" defaultValue={profile.positionId || ""}
                    className="h-9 px-2.5 rounded-lg bg-input border border-default text-[11px] text-primary focus:outline-none focus:border-[var(--accent-primary)]">
                    <option value="" className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">--</option>
                    {editPositions.map((p: any) => (
                      <option key={p.id} value={p.id} className="bg-white dark:bg-[#1e293b] text-gray-900 dark:text-gray-100">{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Carga (h/sem)</label>
                  <input name="weeklyHours" type="number" defaultValue={profile.weeklyHours}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-primary)] transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Escala</label>
                  <input name="workSchedule" defaultValue={profile.workSchedule}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-primary)] transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Telefone</label>
                  <input name="phone" defaultValue={profile.phone || ""}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[var(--accent-primary)] transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Matrícula</label>
                  <input disabled value={profile.registrationNumber ? `CHR${profile.registrationNumber}` : "Gerada automaticamente"}
                    className="w-full h-9 px-3 rounded-lg bg-input border border-default text-xs text-muted opacity-60 cursor-not-allowed" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setEditingMember(false)}
                  className="flex-1 h-10 rounded-lg bg-surface border border-default text-xs font-medium text-secondary hover:text-primary hover:bg-white/[0.04] transition-all"
                >Cancelar</button>
                <button type="submit"
                  className="flex-1 h-10 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-white hover:opacity-90 transition-all"
                >Salvar alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFaceModal && (
        <FaceRegistrationModal
          onComplete={async (descriptors, images) => {
            await apiFace.register(descriptors, images)
            setShowFaceModal(false)
            setFaceRegistered(true)
          }}
          onSkip={() => setShowFaceModal(false)}
        />
      )}

    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-4">{title}</h3>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-primary">{value}</p>
    </div>
  )
}
