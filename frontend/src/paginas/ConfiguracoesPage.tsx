import { useState, useRef, useEffect, useCallback } from "react"
import {
  User, Palette, Bell, Shield, Lock,
  Moon, Sun, Monitor, Camera, Eye, EyeOff, Loader2, Check,
  Laptop, Globe, Clock, Key, Download,
  FileText, LogIn, ChevronRight, Fingerprint, CheckCircle2, XCircle,
} from "lucide-react"
import { useTheme, type ThemeMode, type AccentColor } from "../contexts/ThemeContext"
import { PageHeader } from "../componentes/PageHeader"
import { uploadAvatar, auth, faceRegistration as apiFace } from "../services/api"
import { PerfilPage } from "./PerfilPage"
import { FaceRegistrationModal } from "../componentes/FaceRegistrationModal"

type SectionKey = "perfil" | "aparencia" | "notificacoes" | "seguranca" | "face" | "privacidade"

const SECTIONS: { key: SectionKey; label: string; icon: any }[] = [
  { key: "perfil", label: "Perfil", icon: User },
  { key: "aparencia", label: "Aparência", icon: Palette },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "seguranca", label: "Segurança", icon: Shield },
  { key: "face", label: "Reconhecimento Facial", icon: Fingerprint },
  { key: "privacidade", label: "Privacidade", icon: Lock },
]

type NotifCategory = "sistema" | "jornada" | "rh" | "relatorios"

const NOTIF_ITEMS: Record<NotifCategory, { key: string; label: string }[]> = {
  sistema: [
    { key: "sistema_atualizacoes", label: "Atualizações do sistema" },
    { key: "sistema_manutencao", label: "Manutenções programadas" },
    { key: "sistema_novidades", label: "Novidades do Chronos" },
  ],
  jornada: [
    { key: "jornada_entrada", label: "Lembrete de entrada" },
    { key: "jornada_saida", label: "Lembrete de saída" },
    { key: "jornada_intervalo", label: "Intervalo pendente" },
    { key: "jornada_negativo", label: "Banco de horas negativo" },
    { key: "jornada_positivo", label: "Banco de horas positivo relevante" },
    { key: "jornada_incompleto", label: "Registro incompleto" },
  ],
  rh: [
    { key: "rh_recebidas", label: "Justificativas recebidas" },
    { key: "rh_aprovadas", label: "Justificativas aprovadas" },
    { key: "rh_recusadas", label: "Justificativas recusadas" },
    { key: "rh_pendentes", label: "Solicitações pendentes" },
  ],
  relatorios: [
    { key: "relatorio_mensal", label: "Relatório mensal disponível" },
    { key: "exportacoes", label: "Exportações concluídas" },
  ],
}

const CATEGORY_LABELS: Record<NotifCategory, string> = {
  sistema: "Sistema",
  jornada: "Jornada",
  rh: "RH",
  relatorios: "Relatórios",
}

const ACCENT_OPTIONS: { key: AccentColor; label: string; bg: string }[] = [
  { key: "blue", label: "Azul Chronos", bg: "bg-[#628ECB]" },
  { key: "green", label: "Verde Corporativo", bg: "bg-[#5B9B7A]" },
  { key: "purple", label: "Roxo Executivo", bg: "bg-[#5B3E96]" },
  { key: "gold", label: "Laranja Profissional", bg: "bg-[#C49A6B]" },
  { key: "red", label: "Vermelho Corporativo", bg: "bg-[#C96B6B]" },
  { key: "gray", label: "Rosa", bg: "bg-[#D96C8C]" },
  { key: "teal", label: "Turquesa", bg: "bg-[#2DD4BF]" },
]

const ACCENT_PREVIEW: Record<AccentColor, { primary: string; hover: string; sidebar: string; sidebarHover: string }> = {
  blue: { primary: "#628ECB", hover: "#7AA5DE", sidebar: "#2C5282", sidebarHover: "#628ECB" },
  green: { primary: "#5B9B7A", hover: "#72B38E", sidebar: "#2D5A3F", sidebarHover: "#5B9B7A" },
  purple: { primary: "#5B3E96", hover: "#6F4FAF", sidebar: "#2D1B69", sidebarHover: "#4A2E8A" },
  gold: { primary: "#C49A6B", hover: "#D4AE80", sidebar: "#8B6C47", sidebarHover: "#C49A6B" },
  red: { primary: "#C96B6B", hover: "#D98C8C", sidebar: "#8B3D3D", sidebarHover: "#C96B6B" },
  gray: { primary: "#D96C8C", hover: "#E88DA8", sidebar: "#8B2D4A", sidebarHover: "#D96C8C" },
  teal: { primary: "#2DD4BF", hover: "#5EEAD4", sidebar: "#0D7C6E", sidebarHover: "#2DD4BF" },
}

function PreviewCard({ accent, themeMode }: { accent: AccentColor; themeMode: ThemeMode }) {
  const c = ACCENT_PREVIEW[accent]
  const dark = themeMode === "dark" || (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const bgApp = dark ? "#081120" : "#F8FAFF"
  const bgSurface = dark ? "#0E1C36" : "#FFFFFF"
  const textPrimary = dark ? "#F0F3FA" : "#1B2A41"
  const textMuted = "#8A97AB"
  const borderColor = dark ? "rgba(255,255,255,0.05)" : "#D5DEEF"

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor, backgroundColor: bgApp }}>
      <div className="flex h-[420px]">
        <div className="w-52 shrink-0 flex flex-col gap-4 px-3 py-5" style={{ backgroundColor: c.sidebar }}>
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.hover }}>
              <span className="text-white text-[10px] font-bold">C</span>
            </div>
            <span className="text-white text-xs font-bold">Chronos</span>
          </div>
          {[{ icon: "◆", label: "Dashboard", active: true },
            { icon: "◈", label: "Equipe", active: false },
            { icon: "◉", label: "Jornada", active: false },
            { icon: "▣", label: "Relatórios", active: false },
            { icon: "⚙", label: "Configurações", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
              style={{
                backgroundColor: item.active ? c.hover : "transparent",
                color: item.active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
              }}
            >
              <span className="w-4 text-center" style={{ fontSize: 10 }}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
          <div className="mt-auto flex items-center gap-2 px-2 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="w-6 h-6 rounded-full bg-white/20" />
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-white/80">Milena Silva</span>
              <span className="text-[8px] text-white/50">Designer</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col" style={{ backgroundColor: bgApp }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ backgroundColor: bgSurface, borderColor }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold" style={{ color: textPrimary }}>Dashboard</span>
              <div className="h-5 w-px" style={{ backgroundColor: borderColor }} />
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: `${c.primary}10` }}>
                <span className="text-[10px] font-medium" style={{ color: c.primary }}>Março 2026</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-7 rounded-md text-[9px] px-2.5 flex items-center" style={{ backgroundColor: bgApp, color: textMuted }}>
                Buscar...
              </div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${c.primary}15` }}>
                <span style={{ color: c.primary, fontSize: 12 }}>🔔</span>
              </div>
            </div>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Colaboradores", value: "24", active: true },
                { label: "Horas hoje", value: "156h", active: false },
                { label: "Pendências", value: "3", active: false },
                { label: "Férias", value: "2", active: false },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border p-3 flex flex-col gap-1"
                  style={{
                    backgroundColor: stat.active ? c.primary : bgSurface,
                    borderColor: stat.active ? "transparent" : borderColor,
                  }}
                >
                  <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: stat.active ? "rgba(255,255,255,0.8)" : textMuted }}>
                    {stat.label}
                  </span>
                  <span className="text-lg font-bold" style={{ color: stat.active ? "#FFFFFF" : textPrimary }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex-1 rounded-lg border p-4 flex flex-col gap-3" style={{ backgroundColor: bgSurface, borderColor }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: textPrimary }}>Registros recentes</span>
                <span className="text-[10px] font-medium" style={{ color: c.primary }}>Ver todos →</span>
              </div>
              <div className="grid grid-cols-4 gap-3 pb-2 border-b" style={{ borderColor }}>
                {["Nome", "Data", "Entrada", "Status"].map((h) => (
                  <span key={h} className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                    {h}
                  </span>
                ))}
              </div>
              {[
                { name: "Ana Costa", date: "30/05", time: "08:12", status: "OK" },
                { name: "Bruno Lima", date: "30/05", time: "08:05", status: "OK" },
                { name: "Carla Dias", date: "30/05", time: "09:01", status: "Atrasado" },
              ].map((row) => (
                <div key={row.name} className="grid grid-cols-4 gap-3 py-1.5">
                  <span className="text-[11px] font-medium" style={{ color: textPrimary }}>{row.name}</span>
                  <span className="text-[11px]" style={{ color: textMuted }}>{row.date}</span>
                  <span className="text-[11px]" style={{ color: textMuted }}>{row.time}</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit"
                    style={{
                      backgroundColor: row.status === "OK" ? `${c.primary}15` : `${ACCENT_PREVIEW.red.primary}15`,
                      color: row.status === "OK" ? c.primary : ACCENT_PREVIEW.red.primary,
                    }}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-300 ${
        checked ? "bg-[var(--accent-primary)]" : "bg-[#395886]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  )
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-modal ${
        type === "success" ? "bg-[#5B9B7A] text-white" : "bg-[#C96B6B] text-white"
      }`}>
        <Check size={15} strokeWidth={2.5} />
        {message}
      </div>
    </div>
  )
}

export function ConfiguracoesPage({ userId, user, onAvatarUpdate }: { userId?: string; user?: { name: string; email: string; position?: string | null; avatar?: string | null }; onAvatarUpdate?: (url: string) => void }) {
  const { themeMode, setThemeMode, themeAccent, setThemeAccent } = useTheme()

  const [activeSection, setActiveSection] = useState<SectionKey>("perfil")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [pendingAccent, setPendingAccent] = useState<AccentColor | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar || null)
  const [uploading, setUploading] = useState(false)

  const [notifCategory, setNotifCategory] = useState<NotifCategory>("jornada")
  const [notifEnabled, setNotifEnabled] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("chronos-notifications")
    if (saved) return JSON.parse(saved)
    return {}
  })
  const [notifChannel, setNotifChannel] = useState<"internal" | "email" | "both">(() => {
    return (localStorage.getItem("chronos-notif-channel") as "internal" | "email" | "both") || "internal"
  })

  const [nome, setNome] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [cargo, setCargo] = useState(user?.position || "")

  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)

  const [exportSelected, setExportSelected] = useState<Record<string, boolean>>({
    profile: true, records: true, banco: true, justificativas: true, relatorios: true,
  })

  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null)
  const [faceLoading, setFaceLoading] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState(false)

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    localStorage.setItem("chronos-notifications", JSON.stringify(notifEnabled))
  }, [notifEnabled])

  useEffect(() => {
    localStorage.setItem("chronos-notif-channel", notifChannel)
  }, [notifChannel])

  async function fetchFaceStatus() {
    setFaceLoading(true)
    try {
      const res = await apiFace.status()
      setFaceRegistered(res.registered)
    } catch {
      setFaceRegistered(false)
    } finally {
      setFaceLoading(false)
    }
  }

  useEffect(() => {
    if (activeSection === "face") fetchFaceStatus()
  }, [activeSection])

  useEffect(() => {
    fetchFaceStatus()
  }, [])

  function toggleNotif(key: string) {
    setNotifEnabled((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast("A imagem deve ter no máximo 2MB.", "error")
      return
    }
    setUploading(true)
    try {
      const result = await uploadAvatar(file)
      setAvatarUrl(result.avatarUrl)
      onAvatarUpdate?.(result.avatarUrl)
      showToast("Foto de perfil atualizada.")
    } catch {
      showToast("Erro ao enviar imagem.", "error")
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveProfile() {
    try {
      await auth.updateProfile({ name: nome, position: cargo })
      showToast("Perfil atualizado com sucesso.")
    } catch {
      showToast("Erro ao salvar perfil.", "error")
    }
  }

  const inputClass = "h-10 w-full px-3 rounded-lg border border-default/20 bg-input text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-ring)] transition-all duration-200"
  const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-muted"

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie suas preferências e controle do ambiente de trabalho."
      />

      <div className="flex gap-1 rounded-lg bg-elevated/30 p-0.5 flex-wrap">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = activeSection === s.key
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                isActive
                  ? "bg-[var(--accent-primary)] text-white"
                  : "text-muted hover:text-primary"
              }`}
            >
              <Icon size={12} strokeWidth={2} />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-8">
        {activeSection === "perfil" && (
          userId ? (
            <PerfilPage memberId={userId} user={user} onBack={() => setActiveSection("perfil")} embedded onAvatarUpdate={onAvatarUpdate} />
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex items-start gap-6">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full bg-elevated/40 overflow-hidden flex items-center justify-center ring-2 ring-[var(--accent-border)]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-muted" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 size={10} strokeWidth={2.5} className="text-white animate-spin" /> : <Camera size={10} strokeWidth={2.5} className="text-white" />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-lg font-bold text-primary">Informações pessoais</h2>
                  <p className="text-xs text-muted">Seus dados de perfil são privados e não são compartilhados.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Nome completo</label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>E-mail</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Cargo</label>
                  <input value={cargo} onChange={(e) => setCargo(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <button
                  onClick={handleSaveProfile}
                  className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                >
                  Salvar alterações
                </button>
              </div>
            </div>
          )
        )}

        {/* ═══════════════ APARÊNCIA ═══════════════ */}
        {activeSection === "aparencia" && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-bold text-primary">Tema</h2>
              <p className="text-xs text-muted">Escolha como o Chronos deve ser exibido.</p>
            </div>
            <div className="flex items-center gap-2">
              {([
                { mode: "light" as ThemeMode, label: "Claro", icon: Sun },
                { mode: "dark" as ThemeMode, label: "Escuro", icon: Moon },
                { mode: "system" as ThemeMode, label: "Sistema", icon: Monitor },
              ] as const).map((opt) => {
                const active = opt.mode === themeMode
                return (
                  <button
                    key={opt.mode}
                    onClick={() => { setThemeMode(opt.mode); auth.updatePreferences({ themeMode: opt.mode }).catch(() => {}) }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-[var(--accent-primary)] text-white shadow-sm"
                        : "text-muted hover:text-primary border border-default/20 hover:border-default"
                    }`}
                  >
                    <opt.icon size={15} strokeWidth={2} />
                    {opt.label}
                  </button>
                )
              })}
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-bold text-primary">Cor principal</h2>
              <p className="text-xs text-muted">Clique nas cores abaixo para simular como fica no sistema.</p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              {ACCENT_OPTIONS.map((c) => {
                const isPending = (pendingAccent ?? themeAccent) === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setPendingAccent(c.key)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isPending
                        ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]"
                        : "text-muted hover:text-primary hover:bg-elevated/30"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${c.bg} shrink-0`} />
                    {c.label}
                  </button>
                )
              })}
            </div>

            <PreviewCard accent={pendingAccent ?? themeAccent} themeMode={themeMode} />

            {pendingAccent != null && pendingAccent !== themeAccent && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setThemeAccent(pendingAccent)
                    setPendingAccent(null)
                    showToast("Cor aplicada com sucesso.")
                    auth.updatePreferences({ themeAccent: pendingAccent }).catch(() => {})
                  }}
                  className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setPendingAccent(null)}
                  className="h-9 px-5 rounded-lg border border-default/20 text-xs font-semibold text-muted hover:text-primary transition-all duration-200"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ NOTIFICAÇÕES ═══════════════ */}
        {activeSection === "notificacoes" && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-bold text-primary">Notificações</h2>
              <p className="text-xs text-muted">Controle quais notificações você deseja receber e como.</p>
            </div>

            <div className="flex gap-1 rounded-lg bg-elevated/30 p-0.5">
              {(Object.keys(CATEGORY_LABELS) as NotifCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNotifCategory(cat)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    notifCategory === cat
                      ? "bg-[var(--accent-primary)] text-white"
                      : "text-muted hover:text-primary"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {NOTIF_ITEMS[notifCategory].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/15 transition-all duration-200"
                >
                  <span className="text-sm text-primary">{item.label}</span>
                  <Toggle checked={!!notifEnabled[item.key]} onChange={() => toggleNotif(item.key)} />
                </div>
              ))}
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Forma de recebimento</h3>
              <div className="flex items-center gap-4">
                {([
                  { value: "internal" as const, label: "Apenas notificações internas" },
                  { value: "email" as const, label: "Apenas e-mail" },
                  { value: "both" as const, label: "Ambos" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNotifChannel(opt.value)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      notifChannel === opt.value
                        ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]"
                        : "text-muted hover:text-primary border border-default/20 hover:border-default"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                      notifChannel === opt.value ? "border-[var(--accent-primary)]" : "border-muted"
                    }`}>
                      {notifChannel === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ SEGURANÇA ═══════════════ */}
        {activeSection === "seguranca" && (
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Key size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Alterar senha</h2>
              </div>
              <div className="flex flex-col gap-3 max-w-md">
                <div className="relative">
                  <input
                    type={showSenhaAtual ? "text" : "password"}
                    placeholder="Senha atual"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className={inputClass + " pr-9"}
                  />
                  <button
                    onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                  >
                    {showSenhaAtual ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNovaSenha ? "text" : "password"}
                    placeholder="Nova senha"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className={inputClass + " pr-9"}
                  />
                  <button
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                  >
                    {showNovaSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className={inputClass}
                />
                <div>
                  <button
                    disabled={!senhaAtual || !novaSenha || novaSenha !== confirmarSenha}
                    className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Atualizar senha
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Laptop size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Sessões ativas</h2>
              </div>
              <div className="flex flex-col gap-2 max-w-lg">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-elevated/15">
                  <span className="w-2 h-2 rounded-full bg-[#5B9B7A] shrink-0" />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">Chrome</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#5B9B7A]/10 text-[#5B9B7A] font-semibold">Sessão atual</span>
                    </div>
                    <span className="text-[11px] text-muted">Windows — Brasília, DF</span>
                    <span className="text-[10px] text-muted">Acesso em 30/05/2026 14:32</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="w-2 h-2 rounded-full bg-muted shrink-0" />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-primary">Firefox</span>
                    <span className="text-[11px] text-muted">Windows — Brasília, DF</span>
                    <span className="text-[10px] text-muted">Acesso em 28/05/2026 09:15</span>
                  </div>
                </div>
                <div className="pt-2">
                  <button className="text-[11px] font-semibold text-[var(--accent-primary)] hover:opacity-70 transition-opacity">
                    Encerrar outras sessões
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Histórico de acessos</h2>
              </div>
              <div className="flex flex-col gap-1 max-w-lg">
                {[
                  { date: "30/05/2026", time: "14:32", device: "Chrome / Windows", location: "Brasília, DF" },
                  { date: "28/05/2026", time: "09:15", device: "Firefox / Windows", location: "Brasília, DF" },
                  { date: "27/05/2026", time: "08:00", device: "Chrome / Android", location: "Brasília, DF" },
                ].map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <Globe size={13} className="text-muted shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-primary">{a.device}</span>
                        <span className="text-[10px] text-muted">{a.location}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-muted shrink-0">{a.date} {a.time}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <button className="text-[11px] font-semibold text-[var(--accent-primary)] hover:opacity-70 transition-opacity">
                    Ver todos os acessos
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <LogIn size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Métodos de acesso</h2>
              </div>
              <div className="flex flex-col gap-2 max-w-md">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="text-xs text-primary">Login por e-mail</span>
                  <span className="text-[11px] font-mono text-muted">{user?.email || "---"}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="text-xs text-primary">Login por matrícula</span>
                  <span className="text-[11px] font-mono text-muted">CHR10004</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="text-xs text-primary">E-mail verificado</span>
                  <span className="text-[11px] font-semibold text-[#5B9B7A]">Sim</span>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="text-xs text-primary">Criação da conta</span>
                  <span className="text-[11px] font-mono text-muted">15/01/2026</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ RECONHECIMENTO FACIAL ═══════════════ */}
        {activeSection === "face" && (
          <div className="flex flex-col gap-6 max-w-lg">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Fingerprint size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Biometria Facial</h2>
              </div>
              <p className="text-xs text-secondary mb-5">
                O reconhecimento facial é utilizado para validar sua identidade no momento do registro de ponto,
                garantindo maior segurança e precisão nas marcações.
              </p>

              {faceLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  Verificando cadastro facial...
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-elevated/15">
                    {faceRegistered ? (
                      <>
                        <CheckCircle2 size="18" className="text-[#5B9B7A] shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-primary">Face cadastrada</span>
                          <span className="text-[11px] text-secondary">Sua identidade facial está registrada e será utilizada nos registros de ponto.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size="18" className="text-[#D94A4A] shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-primary">Face não cadastrada</span>
                          <span className="text-[11px] text-secondary">Você ainda não cadastrou sua biometria facial. Registre-se para utilizar o reconhecimento facial.</span>
                        </div>
                      </>
                    )}
                  </div>

                  {faceRegistered ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setShowFaceModal(true)}
                        className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 w-fit"
                      >
                        Re cadastrar face
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFaceModal(true)}
                      className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 w-fit"
                    >
                      Cadastrar face agora
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ PRIVACIDADE ═══════════════ */}
        {activeSection === "privacidade" && (
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Retenção de dados</h2>
              </div>
              <div className="flex flex-col gap-1">
                {[
                  "Registros de jornada armazenados conforme legislação vigente.",
                  "Banco de horas armazenado conforme política da empresa.",
                  "Justificativas armazenadas para auditoria.",
                  "Relatórios armazenados conforme requisitos legais.",
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-2 px-4">
                    <span className="w-1 h-1 rounded-full bg-[var(--accent-primary)] shrink-0" />
                    <span className="text-xs text-secondary">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Download size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Exportação de dados</h2>
              </div>
              <div className="flex flex-col gap-1 mb-4">
                {[
                  { key: "profile", label: "Dados do perfil" },
                  { key: "records", label: "Registros de jornada" },
                  { key: "banco", label: "Banco de horas" },
                  { key: "justificativas", label: "Justificativas" },
                  { key: "relatorios", label: "Relatórios" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setExportSelected((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                    className="flex items-center gap-2.5 py-2 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200"
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      exportSelected[opt.key]
                        ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                        : "border-white/20"
                    }`}>
                      {exportSelected[opt.key] && <span className="w-1.5 h-1.5 rounded-sm bg-white" />}
                    </span>
                    <span className="text-xs text-primary">{opt.label}</span>
                  </button>
                ))}
              </div>
              <button className="h-9 px-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200">
                Solicitar exportação
              </button>
              <p className="text-[11px] text-muted mt-3">
                Seu arquivo está sendo preparado. Você será notificado quando estiver disponível.
              </p>
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Termos e consentimentos</h2>
              </div>
              <div className="flex flex-col gap-3 max-w-lg">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="text-xs text-primary">Termos de Uso</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted">Aceito em 15/01/2026</span>
                    <ChevronRight size={13} className="text-muted" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-elevated/10 transition-all duration-200">
                  <span className="text-xs text-primary">Política de Privacidade</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted">Aceito em 15/01/2026 — v2.1</span>
                    <ChevronRight size={13} className="text-muted" />
                  </div>
                </div>
                <div className="pt-2">
                  <button className="text-[11px] font-semibold text-[var(--accent-primary)] hover:opacity-70 transition-opacity">
                    Visualizar documentos
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-elevated/20" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-muted" />
                <h2 className="text-sm font-bold text-primary">Tratamento de dados</h2>
              </div>
              <div className="max-w-2xl">
                <p className="text-xs text-secondary leading-relaxed">
                  Os dados armazenados no Chronos são utilizados exclusivamente para gestão de jornada,
                  banco de horas, relatórios, auditoria e demais funcionalidades relacionadas à administração
                  de colaboradores, respeitando as permissões definidas pela empresa.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showFaceModal && (
        <FaceRegistrationModal
          onComplete={async (descriptors, images) => {
            await apiFace.register(descriptors, images)
            setShowFaceModal(false)
            setFaceRegistered(true)
            showToast("Face cadastrada com sucesso!")
          }}
          onSkip={() => setShowFaceModal(false)}
        />
      )}
    </div>
  )
}
