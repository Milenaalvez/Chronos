import { useState, useMemo, useEffect } from "react"
import {
  LayoutDashboard,
  Fingerprint,
  Clock3,
  ClipboardList,
  BarChart3,
  Calendar,
  Bell,
  Settings,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Users,
  UserCheck,
} from "lucide-react"
import { useTheme } from "../contexts/ThemeContext"
import { auth as apiAuth } from "../services/api"
import { canAccess } from "../utils/permissions"

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
  onLogout: () => void
  onSwitchAccount?: (token: string, user: any, refreshToken?: string) => void
  user?: { name: string; position?: string | null; role?: string; avatar?: string | null; permissions?: string[] } | null
  notificationCount?: number
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

interface MenuGroup {
  label?: string
  items: { label: string; icon: any; page: string; badge?: number }[]
}

export function Sidebar({ activePage, onNavigate, onLogout, onSwitchAccount, user, notificationCount = 0, sidebarOpen, onToggleSidebar }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const userCanSwitch = canAccess(user, "switch_accounts")
  const avatarVersion = useMemo(() => user?.avatar ? Date.now() : 0, [user?.avatar])

  function closeAll() {
    setProfileOpen(false)
  }

  useEffect(() => {
    if (profileOpen && userCanSwitch && !loadingAccounts) {
      setLoadingAccounts(true)
      apiAuth.accessibleAccounts().then((data) => {
        setAccounts(Array.isArray(data) ? data.filter((a: any) => a.id !== (user as any)?.id) : [])
      }).catch(() => {}).finally(() => setLoadingAccounts(false))
    }
  }, [profileOpen, userCanSwitch, (user as any)?.id])

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const menuGroups: MenuGroup[] = useMemo(() => [
    {
      items: [
        { label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
      ],
    },
    {
      label: "Registro de Ponto",
      items: [
        { label: "Registrar Ponto", icon: Fingerprint, page: "ponto-registrar" },
        { label: "Meus Registros", icon: ClipboardList, page: "ponto-meus-registros" },
      ],
    },
    {
      items: [
        { label: "Banco de Horas", icon: Clock3, page: "banco" },
        { label: "Relatórios", icon: BarChart3, page: "relatorios" },
        { label: "Calendário", icon: Calendar, page: "calendario" },
        { label: "Equipe", icon: Users, page: "equipe" },
        { label: "Notificações", icon: Bell, page: "notificacoes" },
        { label: "Configurações", icon: Settings, page: "configuracoes" },
      ],
    },
  ], [])

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={onToggleSidebar} />
      )}
      <aside className={`fixed top-0 left-0 w-72 h-screen flex flex-col sidebar-bg border-r border-white/5 select-none z-30 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Mobile close button */}
        <button
          onClick={onToggleSidebar}
          className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-[#F0F3FA]/60 hover:text-[#FFFFFF] hover:bg-white/5 transition-all duration-200 lg:hidden"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      {/* Logo */}
      <div className="flex items-center gap-7 px-8 pt-11 pb-8">
        <div className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 24px color-mix(in srgb, var(--accent-primary) 40%, transparent)' }}>
          <svg viewBox="0 0 48 48" className="w-full h-full">
            <circle cx="24" cy="24" r="21" fill="none" stroke="#B1C9EF" strokeWidth="2.5" strokeDasharray="118 14" strokeDashoffset="16" strokeLinecap="round" />
            <line x1="24" y1="24" x2="24" y2="14" stroke="#F0F3FA" strokeWidth="3" strokeLinecap="round" />
            <line x1="24" y1="24" x2="33" y2="24" stroke="#F0F3FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
            <circle cx="24" cy="24" r="3" fill="#F0F3FA" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-[#FFFFFF] leading-none tracking-tight">Chronos</h1>
          <span className="text-[10px] text-[#F0F3FA] leading-tight font-semibold uppercase tracking-[0.18em]">Gestão de Pessoas</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col px-5 overflow-y-auto">
        {menuGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="flex items-center gap-2 px-4 pt-1 pb-1.5">
                <span className="text-[9px] font-semibold text-[#F0F3FA]/40 uppercase tracking-[0.15em]">{group.label}</span>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = activePage === item.page
                return (
                  <button
                    key={item.page}
                    onClick={() => onNavigate(item.page)}
                    className={`flex items-center gap-3.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--accent-active-bg)] text-[var(--accent-active-text)]"
                        : "text-[#F0F3FA]/70 hover:text-[#FFFFFF] hover:bg-[var(--accent-hover)]"
                    }`}
                  >
                    <Icon size={15} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.page === "notificacoes" && notificationCount > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#D94A4A] text-[9px] font-bold text-white leading-none">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-5 pb-6 pt-4 border-t border-white/5 mt-auto flex flex-col gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-[#F0F3FA] hover:text-[#FFFFFF] hover:bg-[var(--accent-hover)] transition-all duration-200 group"
          >
            <div className="relative w-11 h-6 rounded-full bg-[var(--sidebar-bg)] border border-[var(--sidebar-bg)] transition-all duration-300 group-hover:border-[var(--accent-active-bg)] shrink-0">
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-[#FFFFFF] shadow-sm transition-all duration-300 flex items-center justify-center ${
                theme === "light" ? "left-0.5" : "left-[22px]"
              }`}
            >
              {theme === "light" ? (
                <Sun size={10} className="text-[#B1C9EF]" />
              ) : (
                <Moon size={10} className="text-[var(--accent-active-bg)]" />
              )}
            </div>
          </div>
          <span className="text-xs font-medium">
            {theme === "light" ? "Modo claro" : "Modo escuro"}
          </span>
        </button>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen((prev) => !prev) }}
            className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl text-sm text-[#F0F3FA] hover:text-[#FFFFFF] hover:bg-[var(--accent-hover)] transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold shadow-sm overflow-hidden">
              {user?.avatar ? (
                <img src={`${user.avatar}?t=${avatarVersion}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center text-[#FFFFFF]">
                  {user?.name ? getInitials(user.name) : 'U'}
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col items-start text-left min-w-0">
              <span className="text-[15px] font-medium text-[#FFFFFF] truncate w-full">{user?.name || 'Usuário'}</span>
              <span className="text-xs text-[#F0F3FA] truncate w-full">{user?.position || user?.role || 'Colaborador'}</span>
            </div>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`text-[#F0F3FA]/60 shrink-0 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => closeAll()} />
              <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-[var(--sidebar-hover)] rounded-xl shadow-xl border border-[var(--sidebar-bg)] overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[60vh] overflow-y-auto">
                {accounts.length > 0 && (
                  <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-[#B1C9EF]/60">
                    Trocar para outra conta existente
                  </div>
                )}
                {accounts.slice(0, 4).map((acc) => (
                  <button key={acc.id} onClick={() => {
                    apiAuth.impersonate(acc.id).then((r) => {
                      closeAll()
                      onSwitchAccount?.(r.token, r.user, r.refreshToken || '')
                    }).catch((err) => {
                      console.error('Erro ao trocar de conta:', err)
                      closeAll()
                    })
                  }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-[#F0F3FA] hover:bg-[var(--accent-primary)] hover:text-[#FFFFFF] transition-all duration-200"
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[8px] font-bold bg-[#395886]">
                      {acc.avatar ? (
                        <img src={acc.avatar} alt="" className="w-full h-full object-cover rounded-md" />
                      ) : (
                        getInitials(acc.name)
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate">{acc.name}</div>
                      <div className="text-[9px] text-[#B1C9EF]/70 truncate">{acc.position || acc.role}</div>
                    </div>
                    <UserCheck size={10} className="text-[#B1C9EF]/50 shrink-0" />
                  </button>
                ))}
                {loadingAccounts && accounts.length === 0 && (
                  <div className="px-4 py-3 text-xs text-[#B1C9EF]/60 text-center">Carregando...</div>
                )}
                {accounts.length > 0 && <div className="h-px bg-[#395886] my-1" />}
                <button
                  onClick={() => { closeAll(); onLogout() }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#F0F3FA] hover:bg-[#D94A4A] hover:text-[#FFFFFF] transition-all duration-200"
                >
                  <LogOut size={15} strokeWidth={2} className="shrink-0" />
                  <span>Sair da conta</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}
