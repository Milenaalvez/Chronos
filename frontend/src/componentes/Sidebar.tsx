import { useState, useMemo, useEffect, useCallback } from "react"
import {
  LayoutDashboard,
  Fingerprint,
  ClipboardList,
  Clock3,
  Users,
  Calendar,
  BarChart3,
  Umbrella,
  Bell,
  Settings,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Moon,
  LogOut,
} from "lucide-react"
import { ChronosBrand } from "./ChronosBrand"
import { useTheme } from "../contexts/ThemeContext"
import { auth as apiAuth } from "../services/api"
import { canAccess, getEffectiveRole, filterMenuGroups, ROLE_SHORT_LABELS } from "../utils/permissions"

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
  onLogout: () => void
  onSwitchAccount?: (token: string, user: any, refreshToken?: string) => void
  user?: { name: string; position?: string | null; role?: string; avatar?: string | null; permissions?: string[] } | null
  notificationCount?: number
  sidebarOpen: boolean
  onToggleSidebar: () => void
  collapsed: boolean
  onCollapseChange: (v: boolean) => void
  impersonatingRole?: string | null
  onExitImpersonation?: () => void
  onImpersonateRole?: (role: string) => void
}

interface MenuItem {
  label: string
  icon: any
  page: string
  badge?: number
}

interface MenuGroup {
  label?: string
  items: MenuItem[]
}

const SECTION_KEYS: Record<string, string> = {
  "Registro de Ponto": "ponto",
  "Gestão": "gestao",
  "RH": "rh",
  "Sistema": "sistema",
}

function loadSectionState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("sidebar-sections")
    if (raw) return JSON.parse(raw)
  } catch {}
  return { ponto: false, gestao: false, rh: true, sistema: false }
}

function saveSectionState(state: Record<string, boolean>) {
  localStorage.setItem("sidebar-sections", JSON.stringify(state))
}

export function Sidebar({ activePage, onNavigate, onLogout, onSwitchAccount, user, notificationCount = 0, sidebarOpen, onToggleSidebar, collapsed, onCollapseChange, impersonatingRole, onExitImpersonation, onImpersonateRole }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [sectionState, setSectionState] = useState<Record<string, boolean>>(loadSectionState)
  const userCanSwitch = canAccess(user, "switch_accounts")

  const effectiveRole = getEffectiveRole(user?.role, impersonatingRole ?? null)
  const avatarVersion = useMemo(() => user?.avatar ? Date.now() : 0, [user?.avatar])

  useEffect(() => {
    saveSectionState(sectionState)
  }, [sectionState])

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

  const toggleSection = useCallback((label: string) => {
    const key = SECTION_KEYS[label]
    if (!key) return
    setSectionState(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const isSectionOpen = useCallback((label: string) => {
    const key = SECTION_KEYS[label]
    return key ? sectionState[key] ?? true : true
  }, [sectionState])

  const allMenuGroups: MenuGroup[] = useMemo(() => [
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
        { label: "Banco de Horas", icon: Clock3, page: "banco" },
      ],
    },
    {
      label: "Gestão",
      items: [
        { label: "Equipe", icon: Users, page: "equipe" },
        { label: "Férias", icon: Umbrella, page: "ferias" },
        { label: "Calendário", icon: Calendar, page: "calendario" },
        { label: "Relatórios", icon: BarChart3, page: "relatorios" },
      ],
    },
    {
      label: "Sistema",
      items: [
        { label: "Notificações", icon: Bell, page: "notificacoes", badge: notificationCount },
        { label: "Configurações", icon: Settings, page: "configuracoes" },
      ],
    },
  ], [notificationCount])

  const menuGroups = useMemo(
    () => filterMenuGroups(allMenuGroups, effectiveRole),
    [allMenuGroups, effectiveRole],
  )

  function NavItem({ item, collapsed: navCollapsed }: { item: MenuItem; collapsed: boolean }) {
    const Icon = item.icon
    const isActive = activePage === item.page
    const content = (
      <button
        onClick={() => onNavigate(item.page)}
        title={navCollapsed ? item.label : undefined}
        className={`group relative flex items-center gap-4 w-full h-11 rounded-xl text-[14px] font-medium transition-all duration-200 ${
          navCollapsed ? "justify-center px-0" : "px-4"
        } ${
          isActive
            ? "bg-[var(--accent-active-bg)]/12 text-[var(--accent-active-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "text-[#F0F3FA]/70 hover:text-[#FFFFFF] hover:bg-white/[0.06]"
        }`}
      >
        <Icon
          size={20}
          strokeWidth={isActive ? 2.5 : 2}
          className={`shrink-0 transition-all duration-200 ${
            isActive
              ? "text-[var(--accent-primary)]"
              : "text-[#F0F3FA]/50 group-hover:text-[#F0F3FA]/80"
          }`}
        />
        {!navCollapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.page === "notificacoes" && notificationCount > 0 && (
              <span className="ml-auto flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#D94A4A] text-[9px] font-bold text-white leading-none shadow-[0_0_8px_rgba(217,74,74,0.5)]">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </>
        )}
      </button>
    )

    if (navCollapsed && notificationCount > 0 && item.page === "notificacoes") {
      return (
        <div className="relative">
          {content}
          <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#D94A4A]" />
        </div>
      )
    }

    return content
  }

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={onToggleSidebar} />
      )}
      <aside className={`fixed top-0 left-0 h-screen flex flex-col sidebar-bg select-none z-30 transition-all duration-250 ease-out lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "w-[68px]" : "w-72"}`}>
        <button
          onClick={onToggleSidebar}
          className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-[#F0F3FA]/60 hover:text-[#FFFFFF] hover:bg-white/5 transition-all duration-200 lg:hidden"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        {/* Logo + collapse */}
        <div className={`flex items-center gap-3 px-8 pt-10 pb-7 ${collapsed ? "justify-center px-0" : ""}`}>
          {collapsed ? (
            <div className="relative w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 20px color-mix(in srgb, var(--accent-primary) 35%, transparent)' }}>
              <svg viewBox="0 0 48 48" className="w-full h-full">
                <circle cx="24" cy="24" r="21" fill="none" stroke="#B1C9EF" strokeWidth="2.5" strokeDasharray="118 14" strokeDashoffset="16" strokeLinecap="round" />
                <line x1="24" y1="24" x2="24" y2="14" stroke="#F0F3FA" strokeWidth="3" strokeLinecap="round" />
                <line x1="24" y1="24" x2="33" y2="24" stroke="#F0F3FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                <circle cx="24" cy="24" r="3" fill="#F0F3FA" />
              </svg>
            </div>
          ) : (
            <>
              <ChronosBrand size="md" dark showSubtitle />
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => onCollapseChange(!collapsed)}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          className={`hidden lg:flex items-center justify-center w-full h-9 text-[#F0F3FA]/40 hover:text-[#F0F3FA]/80 hover:bg-white/[0.04] transition-all duration-200 mb-3 ${collapsed ? "px-0" : "px-5"}`}
        >
          {collapsed ? (
            <PanelRightOpen size={16} strokeWidth={1.5} />
          ) : (
            <div className="flex items-center gap-3 w-full px-5">
              <PanelRightClose size={16} strokeWidth={1.5} />
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Recolher</span>
            </div>
          )}
        </button>

        {impersonatingRole && !collapsed && (
          <div className="mx-3 mb-3 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center gap-2">
            <span className="text-[10px] text-amber-300 font-medium flex-1">
              Visualizando como <strong>{ROLE_SHORT_LABELS[impersonatingRole as keyof typeof ROLE_SHORT_LABELS] || impersonatingRole}</strong>
            </span>
            <button
              onClick={onExitImpersonation}
              className="text-[10px] font-semibold text-amber-300 hover:text-amber-200 transition-colors"
            >
              Sair
            </button>
          </div>
        )}

        <style>{`
          .sidebar-scroll::-webkit-scrollbar {
            width: 3px;
          }
          .sidebar-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .sidebar-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.08);
            border-radius: 99px;
          }
          .sidebar-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.15);
          }
          .sidebar-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.08) transparent;
          }
        `}</style>
        <nav className="flex-1 flex flex-col px-3 overflow-y-auto sidebar-scroll">
          {menuGroups.map((group, gi) => {
            const hasLabel = !!group.label
            const sectionOpen = group.label ? isSectionOpen(group.label) : true

            return (
              <div key={gi} className={gi < menuGroups.length - 1 ? "mb-4" : ""}>
                {hasLabel && (
                  <button
                    onClick={() => group.label && toggleSection(group.label)}
                    title={collapsed ? group.label : undefined}
                    className={`flex items-center w-full mb-1.5 transition-all duration-200 ${
                      collapsed
                        ? "justify-center h-9"
                        : "gap-2 px-4 h-9"
                    }`}
                  >
                    {collapsed ? (
                      <div className="w-6 h-px bg-white/[0.08]" />
                    ) : (
                      <>
                        <ChevronDown
                          size={11}
                          strokeWidth={2.5}
                          className={`shrink-0 text-[#F0F3FA]/40 transition-transform duration-200 ${
                            sectionOpen ? "" : "-rotate-90"
                          }`}
                        />
                        <span className="text-[9px] font-semibold text-[#F0F3FA]/35 uppercase tracking-[0.18em]">{group.label}</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                      </>
                    )}
                  </button>
                )}
                {(!hasLabel || sectionOpen) && (
                  <div className={`flex flex-col gap-1.5 ${collapsed ? "items-center" : ""}`}>
                    {group.items.map((item) => (
                      <NavItem key={item.page} item={item} collapsed={collapsed} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className={`flex flex-col gap-1 pt-3 pb-5 border-t border-white/[0.06] mt-auto ${collapsed ? "items-center px-2" : "px-3"}`}>
          <button
            onClick={toggleTheme}
            title={collapsed ? (theme === "light" ? "Modo claro" : "Modo escuro") : undefined}
            className={`flex items-center gap-4 w-full h-11 rounded-xl text-[14px] font-medium text-[#F0F3FA] hover:text-[#FFFFFF] hover:bg-white/[0.06] transition-all duration-200 group ${
              collapsed ? "justify-center px-0" : "px-4"
            }`}
          >
            <div className="relative w-10 h-5 rounded-full bg-white/[0.08] border border-white/[0.06] transition-all duration-300 group-hover:border-white/20 shrink-0">
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#FFFFFF] shadow-sm transition-all duration-300 flex items-center justify-center ${
                  theme === "light" ? "left-0.5" : "left-[22px]"
                }`}
              >
                {theme === "light" ? (
                  <Sun size={8} className="text-[#628ECB]" />
                ) : (
                  <Moon size={8} className="text-[#628ECB]" />
                )}
              </div>
            </div>
            {!collapsed && <span>{theme === "light" ? "Modo claro" : "Modo escuro"}</span>}
          </button>

          <div className="relative">
            <button
              onClick={() => { setProfileOpen((prev) => !prev) }}
              title={collapsed ? user?.name || 'Usuário' : undefined}
              className={`flex items-center gap-4 w-full h-11 rounded-xl text-[14px] font-medium text-[#F0F3FA] hover:text-[#FFFFFF] hover:bg-white/[0.06] transition-all duration-200 ${
                collapsed ? "justify-center px-0" : "px-4"
              }`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-semibold shadow-sm overflow-hidden">
                {user?.avatar ? (
                  <img src={`${user.avatar}?t=${avatarVersion}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center text-[#FFFFFF]">
                    {user?.name ? getInitials(user.name) : 'U'}
                  </div>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 flex flex-col items-start text-left min-w-0">
                    <span className="text-[14px] font-medium text-[#FFFFFF] truncate w-full">{user?.name || 'Usuário'}</span>
                    <span className="text-[10px] text-[#F0F3FA]/60 truncate w-full">{user?.position || user?.role || 'Colaborador'}</span>
                  </div>
                  <ChevronDown
                    size={14}
                    strokeWidth={2}
                    className={`text-[#F0F3FA]/40 shrink-0 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                  />
                </>
              )}
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => closeAll()} />
                <div className={`absolute ${collapsed ? "left-full ml-2 bottom-0 w-56" : "bottom-full left-0 right-0 mb-1.5"} bg-[var(--sidebar-hover)] rounded-xl shadow-xl border border-[var(--sidebar-bg)] overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[60vh] overflow-y-auto`}>
                  {accounts.length > 0 && (
                    <div className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-[#B1C9EF]/60">
                      Trocar conta
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
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#F0F3FA] hover:bg-[var(--accent-primary)] hover:text-[#FFFFFF] transition-all duration-200"
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold bg-[#395886]">
                        {acc.avatar ? (
                          <img src={acc.avatar} alt="" className="w-full h-full object-cover rounded-md" />
                        ) : (
                          getInitials(acc.name)
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="truncate text-[13px]">{acc.name}</div>
                        <div className="text-[10px] text-[#B1C9EF]/70 truncate">{acc.position || acc.role}</div>
                      </div>
                    </button>
                  ))}
                  {loadingAccounts && accounts.length === 0 && (
                    <div className="px-4 py-3 text-xs text-[#B1C9EF]/60 text-center">Carregando...</div>
                  )}
                  {accounts.length > 0 && <div className="h-px bg-white/[0.06] mx-4 my-1" />}
                  {effectiveRole === "DEVELOPER" && !impersonatingRole && onImpersonateRole && (
                    <>
                      <div className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-[#B1C9EF]/60">
                        Visualizar como
                      </div>
                      {(["ADMIN", "RH", "EMPLOYEE"] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => { closeAll(); onImpersonateRole(role) }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#F0F3FA] hover:bg-[var(--accent-primary)] hover:text-[#FFFFFF] transition-all duration-200"
                        >
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold bg-[#395886]">
                            {ROLE_SHORT_LABELS[role]?.slice(0, 2) || role.slice(0, 2)}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="truncate text-[13px]">{ROLE_SHORT_LABELS[role] || role}</div>
                            <div className="text-[10px] text-[#B1C9EF]/70 truncate">Visualizar como</div>
                          </div>
                        </button>
                      ))}
                      <div className="h-px bg-white/[0.06] mx-4 my-1" />
                    </>
                  )}
                  <button
                    onClick={() => { closeAll(); onLogout() }}
                    className="flex items-center gap-4 w-full h-11 px-4 text-[14px] font-medium text-[#F0F3FA] hover:bg-[#D94A4A] hover:text-[#FFFFFF] transition-all duration-200"
                  >
                    <LogOut size={18} strokeWidth={2} className="shrink-0" />
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
