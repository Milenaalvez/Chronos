import { useState, useEffect, useRef, useMemo } from "react"
import {
  LifeBuoy, Send, Paperclip, X, Search, Plus,
  ChevronDown, Loader2,
} from "lucide-react"
import { tickets as apiTickets } from "../services/api"
import { StatusBadge } from "../componentes/StatusBadge"
import { PageHeader } from "../componentes/PageHeader"
import { canAccess } from "../utils/permissions"
import type {
  Ticket, TicketStatus, TicketCategory,
} from "../types"
import {
  TICKET_STATUS_LABELS, TICKET_CATEGORY_LABELS, TICKET_SUBCATEGORIES,
} from "../types"

const STATUS_ORDER: TicketStatus[] = ["ABERTO", "EM_ANALISE", "AGUARDANDO_RESPOSTA", "RESOLVIDO", "ENCERRADO"]

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return d.toLocaleDateString("pt-BR")
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function getCategoryIcon(category: TicketCategory): string {
  const icons: Record<TicketCategory, string> = {
    SUPORTE_TECNICO: "🛠",
    JORNADA_E_PONTO: "⏰",
    RH_E_BENEFICIOS: "👥",
    ACESSO_E_PERMISSOES: "🔑",
    SUGESTOES_E_MELHORIAS: "💡",
    OUTROS: "📦",
  }
  return icons[category] || "📋"
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

export function SolicitacoesPage({ user }: { user?: { id: string; role: string; name: string; avatar?: string | null; permissions?: string[] } | null }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "ALL">("ALL")
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [novaOpen, setNovaOpen] = useState(false)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [messageInput, setMessageInput] = useState("")
  const [messageFile, setMessageFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isManager = canAccess(user, "manage_tickets")

  useEffect(() => {
    setLoading(true)
    apiTickets.list().then((data) => {
      setTickets(Array.isArray(data) ? data : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [detailTicket?.messages])

  useEffect(() => {
    if (!selectedId) { setDetailTicket(null); return }
    setDetailLoading(true)
    apiTickets.getById(selectedId).then((data) => {
      setDetailTicket(data)
    }).catch(() => {
      setDetailTicket(null)
    }).finally(() => setDetailLoading(false))
  }, [selectedId])

  const filteredTickets = useMemo(() => {
    let list = [...tickets]
    if (filterStatus !== "ALL") {
      list = list.filter(t => t.status === filterStatus)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.protocol.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.user.name.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => {
      const orderA = STATUS_ORDER.indexOf(a.status)
      const orderB = STATUS_ORDER.indexOf(b.status)
      if (orderA !== orderB) return orderA - orderB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [tickets, filterStatus, search])

  const filteredStatuses = useMemo(() => {
    const counts: Record<string, number> = { ALL: tickets.length }
    for (const s of STATUS_ORDER) {
      counts[s] = tickets.filter(t => t.status === s).length
    }
    return counts
  }, [tickets])

  function handleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  async function handleSendMessage() {
    if (!messageInput.trim() || !selectedId || sending) return
    setSending(true)
    try {
      const updated = await apiTickets.addMessage(selectedId, messageInput.trim(), messageFile || undefined)
      setMessageInput("")
      setMessageFile(null)
      setDetailTicket(prev => prev ? {
        ...prev,
        messages: [...prev.messages, updated],
        status: updated.status || prev.status,
      } : prev)
      setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, _count: { ...t._count!, messages: (t._count?.messages || 0) + 1 } } : t))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(newStatus: TicketStatus, note?: string) {
    if (!selectedId) return
    try {
      const updated = await apiTickets.updateStatus(selectedId, newStatus, note || undefined)
      setDetailTicket(updated)
      setTickets(prev => prev.map(t => t.id === selectedId ? updated : t))
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <PageHeader
        title="Central de Solicitações"
        subtitle="Acompanhe e gerencie suas solicitações"
        actions={
          <button
            onClick={() => setNovaOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--accent-primary)] text-white text-[13px] font-semibold hover:brightness-110 transition-all"
          >
            <Plus size={16} /> Nova Solicitação
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          <X size={14} className="shrink-0 cursor-pointer" onClick={() => setError(null)} />
          {error}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* LEFT PANEL */}
        <div className="w-[360px] shrink-0 flex flex-col rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[var(--surface-card)] overflow-hidden">
          {/* Search + Filter */}
          <div className="flex items-center gap-2 p-3 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F0F3FA]/40" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por protocolo, título..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[13px] text-[#F0F3FA] placeholder-[#F0F3FA]/30 outline-none focus:border-[var(--accent-primary)]/40 transition-colors"
              />
            </div>
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilterMenu(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-[#F0F3FA]/70 hover:text-[#F0F3FA] transition-colors"
              >
                {filterStatus === "ALL" ? "Todos" : TICKET_STATUS_LABELS[filterStatus]}
                <ChevronDown size={12} />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--sidebar-bg)] shadow-xl overflow-hidden z-10">
                  <button onClick={() => { setFilterStatus("ALL"); setShowFilterMenu(false) }} className={`flex items-center justify-between w-full px-4 py-2.5 text-[13px] transition-colors ${filterStatus === "ALL" ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/5" : "text-[#F0F3FA]/70 hover:bg-white/[0.04]"}`}>
                    Todos <span className="text-[11px] text-[#F0F3FA]/40">{filteredStatuses.ALL}</span>
                  </button>
                  {STATUS_ORDER.map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setShowFilterMenu(false) }} className={`flex items-center justify-between w-full px-4 py-2.5 text-[13px] transition-colors ${filterStatus === s ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/5" : "text-[#F0F3FA]/70 hover:bg-white/[0.04]"}`}>
                      {TICKET_STATUS_LABELS[s]} <span className="text-[11px] text-[#F0F3FA]/40">{filteredStatuses[s]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={20} className="text-[#F0F3FA]/40 animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[13px] text-[#F0F3FA]/40">
                {search || filterStatus !== "ALL" ? "Nenhuma solicitação encontrada" : "Nenhuma solicitação ainda"}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 p-2">
                {filteredTickets.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelect(ticket.id)}
                    className={`flex flex-col gap-1 w-full p-3 rounded-xl text-left transition-colors ${
                      selectedId === ticket.id
                        ? "bg-[var(--accent-primary)]/8 border border-[var(--accent-primary)]/20"
                        : "hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold text-[#F0F3FA]/50 tracking-wide">{ticket.protocol}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <span className="text-[13px] font-medium text-[#F0F3FA] leading-snug line-clamp-1">{ticket.title}</span>
                    <div className="flex items-center gap-2 text-[11px] text-[#F0F3FA]/40">
                      <span>{ticket.user.name}</span>
                      <span>·</span>
                      <span>{formatRelative(ticket.createdAt)}</span>
                      {ticket._count && ticket._count.messages > 0 && (
                        <>
                          <span>·</span>
                          <span>{ticket._count.messages} msg</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[var(--surface-card)] overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#F0F3FA]/30 gap-3">
              <LifeBuoy size={40} strokeWidth={1} />
              <span className="text-[14px]">Selecione uma solicitação</span>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={20} className="text-[#F0F3FA]/40 animate-spin" />
            </div>
          ) : detailTicket ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3">
                  <span className="text-[18px]">{getCategoryIcon(detailTicket.category)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-[#F0F3FA]/50 tracking-wide">{detailTicket.protocol}</span>
                      <StatusBadge status={detailTicket.status} />
                    </div>
                    <h2 className="text-[15px] font-semibold text-[#F0F3FA] mt-0.5">{detailTicket.title}</h2>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Info section */}
                <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.04)]">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[13px]">
                    <div>
                      <span className="text-[#F0F3FA]/40 text-[11px]">Categoria</span>
                      <p className="text-[#F0F3FA] mt-0.5">{TICKET_CATEGORY_LABELS[detailTicket.category]}</p>
                    </div>
                    {detailTicket.subcategory && (
                      <div>
                        <span className="text-[#F0F3FA]/40 text-[11px]">Subtipo</span>
                        <p className="text-[#F0F3FA] mt-0.5">{detailTicket.subcategory}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[#F0F3FA]/40 text-[11px]">Solicitante</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold bg-[#395886] text-white shrink-0">
                          {detailTicket.user.avatar ? (
                            <img src={detailTicket.user.avatar} alt="" className="w-full h-full object-cover rounded-md" />
                          ) : getInitials(detailTicket.user.name)}
                        </div>
                        <span className="text-[#F0F3FA]">{detailTicket.user.name}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[#F0F3FA]/40 text-[11px]">Responsável</span>
                      <p className="text-[#F0F3FA] mt-0.5">
                        {detailTicket.assignee ? detailTicket.assignee.name : "Não atribuído"}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mt-4">
                    <span className="text-[#F0F3FA]/40 text-[11px]">Descrição</span>
                    <p className="text-[#F0F3FA]/80 text-[13px] mt-1 leading-relaxed whitespace-pre-wrap">{detailTicket.description}</p>
                  </div>

                  {/* Attachments */}
                  {detailTicket.attachments.length > 0 && (
                    <div className="mt-4">
                      <span className="text-[#F0F3FA]/40 text-[11px]">Anexos</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {detailTicket.attachments.map(att => (
                          <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[12px] text-[#F0F3FA]/70 hover:text-[#F0F3FA] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                          >
                            <Paperclip size={12} />
                            <span className="truncate max-w-[200px]">{att.fileName}</span>
                            <span className="text-[#F0F3FA]/30">({formatFileSize(att.fileSize)})</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages timeline */}
                <div className="px-6 py-4">
                  <h3 className="text-[11px] font-semibold text-[#F0F3FA]/40 uppercase tracking-wider mb-4">
                    Histórico ({detailTicket.messages.length} mensagens)
                  </h3>
                  {detailTicket.messages.length === 0 ? (
                    <p className="text-[13px] text-[#F0F3FA]/30 text-center py-8">Nenhuma mensagem ainda</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {detailTicket.messages.map(msg => (
                        <div key={msg.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold bg-[#395886] text-white shrink-0 mt-0.5">
                            {msg.user.avatar ? (
                              <img src={msg.user.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : getInitials(msg.user.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#F0F3FA]">{msg.user.name}</span>
                              {msg.user.role && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-[#F0F3FA]/50">
                                  {msg.user.role === "ADMIN" ? "Admin" : msg.user.role === "DEVELOPER" ? "Dev" : msg.user.role === "RH" ? "RH" : "Colab."}
                                </span>
                              )}
                              <span className="text-[11px] text-[#F0F3FA]/30 ml-auto">{formatDate(msg.createdAt)}</span>
                            </div>
                            <p className="text-[13px] text-[#F0F3FA]/80 mt-1 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>

              {/* Reply + actions */}
              <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
                {isManager && detailTicket.status !== "ENCERRADO" && detailTicket.status !== "RESOLVIDO" && (
                  <div className="flex items-center gap-2 mb-3">
                    {["RESOLVIDO", "ENCERRADO"].map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s as TicketStatus, undefined)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                          s === "RESOLVIDO"
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                        }`}
                      >
                        {s === "RESOLVIDO" ? "✓ Resolver" : "✕ Encerrar"}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder="Digite sua mensagem..."
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[13px] text-[#F0F3FA] placeholder-[#F0F3FA]/30 outline-none focus:border-[var(--accent-primary)]/40 transition-colors resize-none"
                    />
                    {messageFile && (
                      <div className="flex items-center gap-2 mt-2 px-1">
                        <Paperclip size={12} className="text-[var(--accent-primary)]" />
                        <span className="text-[11px] text-[#F0F3FA]/60 truncate flex-1">{messageFile.name}</span>
                        <button onClick={() => setMessageFile(null)} className="text-[#F0F3FA]/30 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="w-9 h-9 rounded-lg flex items-center justify-center text-[#F0F3FA]/40 hover:text-[#F0F3FA]/70 hover:bg-white/[0.06] transition-colors cursor-pointer">
                      <Paperclip size={16} />
                      <input type="file" className="hidden" onChange={e => setMessageFile(e.target.files?.[0] || null)} />
                    </label>
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sending}
                      className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent-primary)] text-white disabled:opacity-30 hover:brightness-110 transition-all"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#F0F3FA]/30 text-[14px]">
              Solicitação não encontrada
            </div>
          )}
        </div>
      </div>

      {/* Nova Solicitação Modal */}
      {novaOpen && (
        <NovaSolicitacaoModal
          onClose={() => setNovaOpen(false)}
          onCreated={(ticket) => {
            setTickets(prev => prev.some(t => t.id === ticket.id) ? prev : [ticket, ...prev])
            setSelectedId(ticket.id)
            setNovaOpen(false)
          }}
        />
      )}
    </div>
  )
}

function NovaSolicitacaoModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ticket: Ticket) => void }) {
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<TicketCategory | null>(null)
  const [subcategory, setSubcategory] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const categories: { key: TicketCategory; icon: string; label: string }[] = [
    { key: "SUPORTE_TECNICO", icon: "🛠", label: "Suporte Técnico" },
    { key: "JORNADA_E_PONTO", icon: "⏰", label: "Jornada e Ponto" },
    { key: "RH_E_BENEFICIOS", icon: "👥", label: "RH e Benefícios" },
    { key: "ACESSO_E_PERMISSOES", icon: "🔑", label: "Acesso e Permissões" },
    { key: "SUGESTOES_E_MELHORIAS", icon: "💡", label: "Sugestões e Melhorias" },
    { key: "OUTROS", icon: "📦", label: "Outros" },
  ]

  async function handleSubmit() {
    if (!title.trim() || !description.trim() || !category) return
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await apiTickets.create(
        { title: title.trim(), description: description.trim(), category, subcategory },
        file || undefined,
      )
      onCreated(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[var(--surface-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#F0F3FA]">Nova Solicitação</h2>
            <p className="text-[12px] text-[#F0F3FA]/40 mt-0.5">Passo {step + 1} de 3</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F0F3FA]/40 hover:text-[#F0F3FA] hover:bg-white/[0.06] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2">
          {[0, 1, 2].map(i => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? "bg-[var(--accent-primary)]" : "bg-[rgba(255,255,255,0.06)]"}`} />
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* Steps */}
        <div className="px-6 py-4">
          {step === 0 && (
            <div>
              <h3 className="text-[13px] font-medium text-[#F0F3FA]/70 mb-3">Selecione a categoria</h3>
              <div className="grid grid-cols-2 gap-3">
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => { setCategory(cat.key); setSubcategory("") }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                      category === cat.key
                        ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/8 text-[var(--accent-primary)]"
                        : "border-[rgba(255,255,255,0.06)] hover:bg-white/[0.04] text-[#F0F3FA]"
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-[12px] font-medium text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && category && (
            <div>
              <h3 className="text-[13px] font-medium text-[#F0F3FA]/70 mb-3">Selecione o subtipo</h3>
              <div className="flex flex-col gap-1">
                {TICKET_SUBCATEGORIES[category].map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSubcategory(sub)}
                    className={`px-4 py-3 rounded-xl text-left text-[13px] transition-colors ${
                      subcategory === sub
                        ? "bg-[var(--accent-primary)]/8 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20"
                        : "text-[#F0F3FA]/70 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-medium text-[#F0F3FA]/50 mb-1.5 block">Título *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Resumo da solicitação"
                  className="w-full h-10 px-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[13px] text-[#F0F3FA] placeholder-[#F0F3FA]/30 outline-none focus:border-[var(--accent-primary)]/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#F0F3FA]/50 mb-1.5 block">Descrição *</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva detalhadamente sua solicitação..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[13px] text-[#F0F3FA] placeholder-[#F0F3FA]/30 outline-none focus:border-[var(--accent-primary)]/40 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#F0F3FA]/50 mb-1.5 block">Anexo (opcional)</label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-dashed border-[rgba(255,255,255,0.1)] cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-colors">
                  <Paperclip size={16} className="text-[#F0F3FA]/40" />
                  <span className="text-[13px] text-[#F0F3FA]/50">
                    {file ? file.name : "Clique para anexar arquivo (PDF, imagem, etc)"}
                  </span>
                  <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  {file && (
                    <button onClick={e => { e.preventDefault(); setFile(null) }} className="ml-auto text-[#F0F3FA]/30 hover:text-red-400">
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.06)]">
          <button
            onClick={() => step > 0 ? setStep(p => p - 1) : onClose()}
            className="h-10 px-4 rounded-xl text-[13px] text-[#F0F3FA]/60 hover:text-[#F0F3FA] hover:bg-white/[0.06] transition-colors"
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </button>
          {step < 2 ? (
            <button
              onClick={() => setStep(p => p + 1)}
              disabled={step === 0 ? !category : !subcategory}
              className="h-10 px-6 rounded-xl bg-[var(--accent-primary)] text-white text-[13px] font-semibold disabled:opacity-30 hover:brightness-110 transition-all"
            >
              Continuar
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || saving}
              className="h-10 px-6 rounded-xl bg-[var(--accent-primary)] text-white text-[13px] font-semibold disabled:opacity-30 hover:brightness-110 transition-all flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Enviando..." : "Enviar Solicitação"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
