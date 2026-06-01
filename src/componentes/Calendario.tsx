import { useState, useMemo, useEffect } from "react"
import { ChevronLeft, ChevronRight, Pencil, Clock, CalendarCheck, AlertTriangle, TrendingUp, Paperclip, CheckCircle2, XCircle } from "lucide-react"
import type { TimeRecord, Justificacao, PageAction } from "../types"
import { formatMinutes, formatDataBR } from "../types"
import { PageHeader } from "./PageHeader"
import { RegisterModal } from "./RegisterModal"
import { JustificacaoModal } from "./JustificacaoModal"
import type { FormData } from "../types"
import { computeSaldo, computeMonthStats, filterMonthRecordsStrict, filterMonthRecords, computeDayBalanceMins, computeAbsences } from "../services/workHoursEngine"

interface CalendarioProps {
  records: TimeRecord[]
  allRecords: TimeRecord[]
  onEdit: (dataISO: string) => void
  onSave: (fd: FormData) => void
  justificacoes: Record<string, Justificacao>
  onJustificar: (data: Justificacao) => void
  pageAction?: PageAction | null
  onClearAction?: () => void
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]

const CATEGORIA_MAP: Record<string, string> = {
  "Atestado médico": "Saúde",
  "Falta justificada": "Administrativo",
  "Férias": "Benefícios",
  "Folga": "Administrativo",
  "Profissional ainda não contratado": "Admissão",
  "Usuário novo / onboarding": "Novo colaborador",
  "Problema no sistema": "Operacional",
  "Licença": "Benefícios",
  "Ausência autorizada": "Administrativo",
  "Outro": "Diversos",
}

const DEFAULT_JUSTIFICATIVA: Record<string, string> = {
  "Atestado médico": "O colaborador esteve afastado por recomendação médica.",
  "Falta justificada": "A falta foi justificada de acordo com as regras da empresa.",
  "Férias": "O colaborador estava de férias no período.",
  "Folga": "Folga programada conforme escala do time.",
  "Profissional ainda não contratado": "O colaborador ainda não havia sido contratado nesta data.",
  "Usuário novo / onboarding": "O colaborador estava em processo de integração na empresa.",
  "Problema no sistema": "Houve um problema no sistema que impediu o registro do ponto.",
  "Licença": "O colaborador estava em licença conforme política interna.",
  "Ausência autorizada": "Ausência foi autorizada previamente pela liderança.",
  "Outro": "Ausência registrada e justificada pelo colaborador.",
}

function DayDetailPanel({ dayDetail, onQuickEdit, DEFAULT_JUSTIFICATIVA, impactoJustificativa, formatDataBR, formatMinutes }: {
  dayDetail: {
    iso: string; label: string; isWeekend: boolean; isFuture: boolean
    isJustified: boolean; isMissing: boolean; isComplete: boolean
    record: TimeRecord | null; saidaIntervalo: string; retornoIntervalo: string
    statusText: string; statusColor: string; dotColor: string
    justificacao: Justificacao | null; justificacaoCategoria: string
  }
  onQuickEdit: (iso: string) => void
  DEFAULT_JUSTIFICATIVA: Record<string, string>
  impactoJustificativa: (motivo: string) => string
  formatDataBR: (date: string) => string
  formatMinutes: (mins: number) => string
}) {
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-semibold text-muted uppercase tracking-widest">{children}</p>
  )

  return (
    <div className="bg-elevated/20 rounded-lg px-4 py-4 flex flex-col gap-4 dark:bg-transparent dark:border dark:border-white/6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-[3px] h-4 rounded-full bg-[var(--accent-primary)] shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-primary tracking-tight">{dayDetail.label}</h3>
            <span className={`text-[10px] font-semibold ${dayDetail.statusColor}`}>{dayDetail.statusText}</span>
          </div>
        </div>
        {!dayDetail.isWeekend && !dayDetail.isFuture && (
          <button
            onClick={() => onQuickEdit(dayDetail.iso)}
            className="flex items-center gap-1.5 px-2.5 h-6 rounded text-[11px] font-medium text-secondary hover:text-primary hover:bg-elevated/50 transition-all duration-200"
          >
            <Pencil size={10} strokeWidth={2} />
            Editar
          </button>
        )}
      </div>

      {dayDetail.isJustified && dayDetail.justificacao && (
        <div className="flex flex-col gap-3">
          {(() => {
            const jStat = dayDetail.justificacao.status
            const isAprovado = jStat === "aprovado"
            const isRecusado = jStat === "recusado"
            const badgeColor = isAprovado ? "#5B9B7A" : isRecusado ? "#C96B6B" : "#C49A6B"
            const badgeBg = isAprovado ? "bg-[#5B9B7A]/8" : isRecusado ? "bg-[#C96B6B]/8" : "bg-[#C49A6B]/8"
            const IconComponent = isAprovado ? CheckCircle2 : isRecusado ? XCircle : Clock
            return (
              <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded ${badgeBg}`}>
                <IconComponent size={14} style={{ color: badgeColor }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold" style={{ color: badgeColor }}>
                    {isAprovado ? "Falta justificada" : isRecusado ? "Justificativa recusada" : "Em análise"}
                  </p>
                  <p className="text-[10px] text-secondary mt-0.5">
                    {isAprovado ? "Aprovado automaticamente" : isRecusado ? "Recusado pelo RH" : "Aguardando análise do RH"}
                  </p>
                </div>
              </div>
            )
          })()}

          <div className="bg-elevated/50 h-px" />

          <SectionLabel>Categoria</SectionLabel>
          <p className="text-sm font-bold text-primary -mt-2">{dayDetail.justificacaoCategoria}</p>

          <SectionLabel>Justificativa</SectionLabel>
          <p className="text-[13px] text-secondary leading-relaxed -mt-2">
            {dayDetail.justificacao.observacao || DEFAULT_JUSTIFICATIVA[dayDetail.justificacao.motivo] || "Ausência registrada e justificada."}
          </p>

          <SectionLabel>Período aplicado</SectionLabel>
          <p className="text-sm font-bold text-primary font-mono -mt-2">
            {formatDataBR(dayDetail.justificacao.dataInicio)} → {formatDataBR(dayDetail.justificacao.dataFim)}
          </p>

          {dayDetail.justificacao.anexoNome && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--accent-primary)]/8">
              <Paperclip size={12} className="text-[var(--accent-primary)] shrink-0" />
              <span className="text-[11px] text-[var(--accent-primary)] font-medium">{dayDetail.justificacao.anexoNome}</span>
            </div>
          )}

          <div className="bg-elevated/50 h-px" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionLabel>Impacto</SectionLabel>
              <span className="text-[13px] text-[#5B9B7A] font-bold">
                Horas abonadas {impactoJustificativa(dayDetail.justificacao.motivo)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <SectionLabel>Saldo</SectionLabel>
              <span className="text-[13px] text-[#C49A6B] font-bold">Não impacta banco de horas</span>
            </div>
          </div>
        </div>
      )}

      {dayDetail.isComplete && dayDetail.record && (
        <div className="flex flex-col gap-3">
          <div className="bg-elevated/50 h-px" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Entrada</span>
            <span className="text-sm font-bold text-primary font-mono">{dayDetail.record.entrada}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Saída almoço</span>
            <span className="text-sm font-bold text-primary font-mono">{dayDetail.saidaIntervalo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Retorno almoço</span>
            <span className="text-sm font-bold text-primary font-mono">{dayDetail.retornoIntervalo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Saída final</span>
            <span className="text-sm font-bold text-primary font-mono">{dayDetail.record.saida}</span>
          </div>
          <div className="bg-elevated/50 h-px" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Total</span>
            <span className="text-sm font-bold text-primary font-mono">{dayDetail.record.total}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Saldo do dia</span>
            {(() => {
              const balMins = computeDayBalanceMins(dayDetail.record!)
              return (
                <span className={`text-sm font-bold font-mono ${balMins >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
                  {balMins >= 0 ? "+" : ""}{formatMinutes(Math.abs(balMins))}
                </span>
              )
            })()}
          </div>
        </div>
      )}

      {dayDetail.isMissing && (
        <div className="px-3 py-2.5 rounded bg-[#C96B6B]/5">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={12} className="text-[#C96B6B] shrink-0" />
            <span className="text-[11px] font-semibold text-[#C96B6B]">Pendência não justificada</span>
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            Nenhum registro de jornada encontrado. Clique em "Editar" para registrar ou justificar esta falta.
          </p>
        </div>
      )}

      {dayDetail.isWeekend && (
        <div className="px-3 py-2.5 rounded bg-elevated/20">
          <p className="text-[11px] text-muted leading-relaxed">Fim de semana — não há registro de jornada.</p>
        </div>
      )}
    </div>
  )
}

function impactoJustificativa(motivo: string): string {
  if (motivo === "Atestado médico") return "mediante documentação"
  if (motivo === "Usuário novo / onboarding" || motivo === "Profissional ainda não contratado") return "automaticamente"
  if (motivo === "Problema no sistema") return "por falha operacional"
  if (motivo === "Férias" || motivo === "Licença") return "conforme política de benefícios"
  if (motivo === "Ausência autorizada" || motivo === "Falta justificada" || motivo === "Folga") return "conforme política interna"
  return "mediante aprovação"
}

const CELL_MOTIVO_LABEL: Record<string, string> = {
  "Atestado médico": "Atestado",
  "Falta justificada": "Falta",
  "Férias": "Férias",
  "Folga": "Folga",
  "Profissional ainda não contratado": "Admissão",
  "Usuário novo / onboarding": "Onboard",
  "Problema no sistema": "Sistema",
  "Licença": "Licença",
  "Ausência autorizada": "Autorizada",
  "Outro": "Outro",
}

const todayISO = () => new Date().toISOString().split("T")[0]
const today = todayISO()

function getMonthDays(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: { iso: string; day: number; dayOfWeek: number }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    days.push({ iso, day: d, dayOfWeek: date.getDay() })
  }
  return days
}

function getWeekDays(refDate: Date) {
  const day = refDate.getDay()
  const monday = new Date(refDate)
  monday.setDate(refDate.getDate() - (day === 0 ? 6 : day - 1))
  const days: { iso: string; day: number; dayOfWeek: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    days.push({ iso, day: d.getDate(), dayOfWeek: d.getDay() })
  }
  return days
}

export function Calendario({ records: _records, allRecords, onEdit: _onEdit, onSave, justificacoes, onJustificar, pageAction, onClearAction }: CalendarioProps) {
  const now = new Date()
  const [viewMode, setViewMode] = useState<"mes" | "semana" | "dia">("mes")
  const [navDate, setNavDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedISO, setSelectedISO] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editDate, setEditDate] = useState<string | undefined>(undefined)
  const [justificarOpen, setJustificarOpen] = useState(false)
  const [justificarDate, setJustificarDate] = useState("")

  const month = navDate.getMonth()
  const year = navDate.getFullYear()

  const days = useMemo(() => {
    if (viewMode === "semana") return getWeekDays(navDate)
    if (viewMode === "dia") {
      const d = new Date(year, month, navDate.getDate())
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      return [{ iso, day: d.getDate(), dayOfWeek: d.getDay() }]
    }
    return getMonthDays(year, month)
  }, [viewMode, year, month, navDate])

  const firstDayOfWeek = viewMode === "mes" ? (days[0]?.dayOfWeek ?? 0) : 0
  const leadingEmpties = viewMode === "mes" ? Array.from({ length: firstDayOfWeek }) : []

  const monthLabel = `${MONTH_NAMES[month]} de ${year}`

  function navigate(delta: number) {
    if (viewMode === "mes") setNavDate(new Date(year, month + delta, 1))
    else if (viewMode === "semana") {
      const d = new Date(navDate)
      d.setDate(d.getDate() + delta * 7)
      setNavDate(d)
    } else {
      const d = new Date(navDate)
      d.setDate(d.getDate() + delta)
      setNavDate(d)
    }
  }

  function goToday() {
    const d = new Date()
    setNavDate(new Date(d.getFullYear(), d.getMonth(), viewMode === "dia" ? d.getDate() : 1))
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    setSelectedISO(iso)
  }

  function handleDayClick(iso: string) {
    setSelectedISO(iso)
  }

  function getRecord(iso: string) {
    return allRecords.find((r) => r.dataISO === iso) ?? null
  }

  function handleQuickEdit(iso: string) {
    const rec = getRecord(iso)
    if ((!rec || rec.tipo === "Pendente") && iso <= today) {
      setJustificarDate(iso)
      setJustificarOpen(true)
    } else {
      setEditDate(iso)
      setEditModalOpen(true)
    }
  }

  useEffect(() => {
    if (pageAction?.type === "selectDay" && pageAction.payload?.dataISO) {
      setSelectedISO(pageAction.payload.dataISO)
      if (onClearAction) onClearAction()
    }
  }, [pageAction])

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`

  const monthBounds = { start: monthStart, end: monthEnd }

  const monthRecords = useMemo(() => {
    return filterMonthRecordsStrict(allRecords, monthBounds)
  }, [allRecords, monthBounds])

  const monthStats = useMemo(() => computeMonthStats(monthRecords), [monthRecords])

  const monthWeekdayISOs = useMemo(() => {
    return days.filter(d => d.dayOfWeek !== 0 && d.dayOfWeek !== 6 && d.iso <= today).map(d => d.iso)
  }, [days])

  const absences = useMemo(() => computeAbsences(allRecords, monthWeekdayISOs, justificacoes), [allRecords, monthWeekdayISOs, justificacoes])

  const monthFaltasCount = absences.faltasCount
  const monthJustificadasCount = absences.justificadasCount
  const monthNaoJustificadasCount = absences.naoJustificadasCount

  const saldoMonthRecords = useMemo(() => {
    return filterMonthRecords(allRecords, monthBounds)
  }, [allRecords, monthBounds])

  const saldoData = useMemo(() => computeSaldo(saldoMonthRecords, justificacoes), [saldoMonthRecords, justificacoes])

  const saldoMins = saldoData.netSaldo
  const saldoDisplay = saldoMins >= 0 ? `+${formatMinutes(saldoMins)}` : formatMinutes(saldoMins)

  const dayDetail = useMemo(() => {
    if (!selectedISO) return null
    const rec = getRecord(selectedISO)
    const d = new Date(selectedISO + "T12:00:00")
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const isFuture = selectedISO > today
    const isJustified = !isWeekend && !isFuture && !!justificacoes[selectedISO]
    const isMissing = !isWeekend && !isFuture && !isJustified && (!rec || rec.tipo === "Pendente")
    const isComplete = !isWeekend && !isFuture && !isJustified && rec != null && rec.tipo !== "Pendente"
    const weekday = WEEKDAY_NAMES[d.getDay()]
    const [y, m, dayNum] = selectedISO.split("-")
    return {
      iso: selectedISO,
      label: `${weekday}, ${dayNum}/${m}/${y}`,
      isWeekend,
      isFuture,
      isJustified,
      isMissing,
      isComplete,
      record: rec,
      saidaIntervalo: rec?.saidaIntervalo ?? "---",
      retornoIntervalo: rec?.retornoIntervalo ?? "---",
      statusText: isWeekend ? "Fim de semana" : isFuture ? "Futuro" : isJustified
        ? justificacoes[selectedISO]?.status === "aprovado" ? "Falta justificada"
          : justificacoes[selectedISO]?.status === "recusado" ? "Justificativa recusada"
          : "Em análise"
        : isMissing ? "Falta" : "Registrado",
      statusColor: isWeekend || isFuture ? "text-[#8AAEE0]" : isJustified
        ? justificacoes[selectedISO]?.status === "aprovado" ? "text-[#5B9B7A]"
          : justificacoes[selectedISO]?.status === "recusado" ? "text-[#C96B6B]"
          : "text-[#C49A6B]"
        : isMissing ? "text-[#C96B6B]" : "text-[#5B9B7A]",
      dotColor: isWeekend || isFuture ? "#8AAEE0" : isJustified ? "#8AAEE0" : isMissing ? "#C96B6B" : "#5B9B7A",
      justificacao: isJustified ? justificacoes[selectedISO] : null,
      justificacaoCategoria: isJustified ? CATEGORIA_MAP[justificacoes[selectedISO]?.motivo] ?? "Diversos" : "",
    }
  }, [selectedISO, allRecords])

  return (
    <div className="flex gap-8">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <PageHeader
          title="Calendário"
          subtitle="Visualize seus registros de horas no calendário."
          actions={
            <div className="flex items-center gap-2.5">
              <div className="flex rounded-md bg-elevated/50 p-0.5 gap-px dark:bg-transparent dark:border dark:border-white/6">
                {(["mes", "semana", "dia"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode)
                    if (mode === "dia") {
                      const d = new Date()
                      setNavDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
                    } else if (mode === "mes") {
                      setNavDate(new Date(navDate.getFullYear(), navDate.getMonth(), 1))
                    }
                  }}
                  className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    viewMode === mode
                       ? "bg-[var(--accent-primary)] text-white"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  {mode === "mes" ? "Mês" : mode === "semana" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <button
              onClick={goToday}
              className="h-8 px-3 rounded-md bg-elevated/50 text-[11px] font-semibold text-secondary hover:text-primary transition-all duration-200 dark:bg-transparent dark:border dark:border-white/6"
            >
              Hoje
            </button>
          </div>
        }
      />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>
            <h2 className="text-lg font-bold text-primary min-w-[180px] text-center select-none">{monthLabel}</h2>
            <button
              onClick={() => navigate(1)}
              className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
          <span className="text-[11px] text-muted font-medium">
            {monthRecords.length} registro{monthRecords.length !== 1 ? "s" : ""} &bull; {formatMinutes(monthStats.totalMins)} acumuladas
          </span>
        </div>

        <div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((name) => (
              <div key={name} className="text-center text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-wider pb-3 pt-1">
                {name}
              </div>
            ))}

            {leadingEmpties.map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {days.map((d) => {
              const rec = getRecord(d.iso)
              const isToday = d.iso === today
              const isSelected = d.iso === selectedISO
              const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6
              const isFuture = d.iso > today
              const isJustified = !isWeekend && !isFuture && !!justificacoes[d.iso]
              const isMissing = !isWeekend && !isFuture && !isJustified && (!rec || rec.tipo === "Pendente")
              const hasRecord = !isWeekend && !isFuture && !isJustified && rec && rec.tipo !== "Pendente"
              const hours = hasRecord ? rec!.totalHours : 0

              let dotColor = "var(--accent-primary)"
              let statusLabel = ""
              let statusColor = ""
              if (isWeekend || isFuture) {
                statusLabel = isWeekend ? "---" : "Futuro"
                statusColor = "text-[var(--accent-primary)]"
              } else if (isJustified) {
                const justStatus = justificacoes[d.iso]?.status
                dotColor = justStatus === "recusado" ? "#C96B6B" : justStatus === "em_analise" ? "#C49A6B" : "var(--accent-primary)"
                statusLabel = CELL_MOTIVO_LABEL[justificacoes[d.iso]?.motivo] || "Justif."
                statusColor = justStatus === "recusado" ? "text-[#C96B6B]" : justStatus === "em_analise" ? "text-[#C49A6B]" : "text-[var(--accent-primary)]"
              } else if (isMissing) {
                dotColor = "#C96B6B"
                statusLabel = "Pend."
                statusColor = "text-[#C96B6B]"
              } else if (hasRecord) {
                dotColor = hours >= 8 ? "#5B9B7A" : "#C49A6B"
                statusLabel = "OK"
                statusColor = "text-[#5B9B7A]"
              }

              let cellBorder = ""
              if (isSelected) cellBorder = "ring-1 ring-[var(--accent-primary)]/30"
              else if (isToday) cellBorder = "ring-1 ring-[var(--accent-primary)]/15"

              return (
                <button
                  key={d.iso}
                  onClick={() => handleDayClick(d.iso)}
                  disabled={isFuture || isWeekend}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-md transition-all duration-200
                    ${isWeekend || isFuture ? "opacity-20 cursor-default" : "cursor-pointer hover:bg-elevated/30 dark:hover:bg-white/[0.03]"}
                    ${cellBorder} group`}
                >
                  <span className={`text-base font-bold leading-none ${isToday && !isSelected ? "text-[var(--accent-primary)]" : "text-primary"}`}>
                    {d.day}
                  </span>

                  {!isWeekend && !isFuture && (
                    <span className={`text-xs font-mono font-semibold leading-tight ${isMissing ? "text-[#C96B6B]" : "text-secondary"}`}>
                      {isJustified ? "---" : hours > 0 ? `${hours >= 10 ? hours.toFixed(1) : hours.toFixed(0)}h` : "0h"}
                    </span>
                  )}

                  {!isWeekend && !isFuture && (
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0`} style={{ backgroundColor: dotColor }} />
                      <span className={`text-[10px] font-medium leading-tight ${statusColor}`}>{statusLabel}</span>
                    </span>
                  )}

                  {(isMissing || isJustified) && (
                    <div className="h-3 flex items-center justify-center">
                      <button
                        onClick={() => handleQuickEdit(d.iso)}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-muted hover:text-[var(--accent-primary)]"
                        title={isJustified ? justificacoes[d.iso]?.motivo || "Justificado" : "Registrar jornada"}
                      >
                        <Pencil size={8} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          {!dayDetail && (
            <div className="flex items-center gap-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
              <p className="text-xs text-muted">Clique em um dia para ver os detalhes da jornada.</p>
            </div>
          )}
        </div>

        {dayDetail && (
          <DayDetailPanel
            dayDetail={dayDetail}
            onQuickEdit={handleQuickEdit}
            DEFAULT_JUSTIFICATIVA={DEFAULT_JUSTIFICATIVA}
            impactoJustificativa={impactoJustificativa}
            formatDataBR={formatDataBR}
            formatMinutes={formatMinutes}
          />
        )}
      </div>

      <div className="w-72 shrink-0 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-[3px] h-4 rounded-full bg-[var(--accent-primary)] shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-primary tracking-tight">Insights</h3>
              <p className="text-[11px] text-muted mt-px">{MONTH_NAMES[month]} de {year}</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-muted">{monthRecords.length} registro{monthRecords.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Summary section */}
        <div className="bg-elevated/20 rounded-lg px-4 py-4 flex flex-col gap-2.5 dark:bg-transparent dark:border dark:border-white/6">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Resumo do mês</span>

          <div className="group flex items-center gap-2.5 px-0.5 py-1 -mx-0.5 rounded transition-all duration-200 hover:bg-elevated/20">
            <Clock size={12} className="text-muted group-hover:text-accent-blue transition-colors duration-200 shrink-0" />
            <span className="text-[11px] text-secondary group-hover:text-primary transition-colors duration-200 flex-1">Horas acumuladas</span>
            <span className="text-sm font-bold text-primary font-mono tracking-tight">{formatMinutes(monthStats.totalMins)}</span>
          </div>

          <div className="bg-elevated/50 h-px mx-0.5" />

          <div className="group flex items-center gap-2.5 px-0.5 py-1 -mx-0.5 rounded transition-all duration-200 hover:bg-elevated/20">
            <CalendarCheck size={12} className="text-muted group-hover:text-accent-blue transition-colors duration-200 shrink-0" />
            <span className="text-[11px] text-secondary group-hover:text-primary transition-colors duration-200 flex-1">Dias registrados</span>
            <span className="text-sm font-bold text-primary font-mono tracking-tight">{monthStats.workedDays}</span>
          </div>

          <div className="bg-elevated/50 h-px mx-0.5" />

          <div className="group flex items-center gap-2.5 px-0.5 py-1 -mx-0.5 rounded transition-all duration-200 hover:bg-elevated/20">
            <TrendingUp size={12} className="text-muted group-hover:text-[#C49A6B] transition-colors duration-200 shrink-0" />
            <span className="text-[11px] text-secondary group-hover:text-primary transition-colors duration-200 flex-1">Horas extras</span>
            <span className="text-sm font-bold text-[#C49A6B] font-mono tracking-tight">{formatMinutes(monthStats.extraMins)}</span>
          </div>
        </div>

        {/* Faltas & Saldo section */}
        <div className="bg-elevated/20 rounded-lg px-4 py-4 flex flex-col gap-2.5 dark:bg-transparent dark:border dark:border-white/6">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Pendências</span>

          <div className="group flex items-center gap-2.5 px-0.5 py-1 -mx-0.5 rounded transition-all duration-200 hover:bg-elevated/20">
            <AlertTriangle size={12} className="text-[#C96B6B]/70 group-hover:text-[#C96B6B] transition-colors duration-200 shrink-0" />
            <span className="text-[11px] text-secondary group-hover:text-primary transition-colors duration-200 flex-1">Faltas</span>
            <span className="text-sm font-bold text-[#C96B6B] font-mono tracking-tight">{monthFaltasCount} dia{monthFaltasCount !== 1 ? "s" : ""}</span>
          </div>

          <div className="flex items-center gap-2 pl-[22px] px-0.5 py-0.5">
            <span className="w-[5px] h-[5px] rounded-full bg-[var(--accent-primary)]/40 shrink-0" />
            <span className="text-[10px] text-secondary flex-1">Justificadas</span>
            <span className="text-[10px] font-semibold text-[var(--accent-primary)] font-mono">{monthJustificadasCount}</span>
          </div>

          <div className="flex items-center gap-2 pl-[22px] px-0.5 py-0.5">
            <span className="w-[5px] h-[5px] rounded-full bg-[#C96B6B]/40 shrink-0" />
            <span className="text-[10px] text-secondary flex-1">Não justificadas</span>
            <span className="text-[10px] font-semibold text-[#C96B6B] font-mono">{monthNaoJustificadasCount}</span>
          </div>

          <div className="bg-elevated/50 h-px mx-0.5" />

          <div className="group flex items-center gap-2.5 px-0.5 py-1 -mx-0.5 rounded transition-all duration-200 hover:bg-elevated/20">
            <TrendingUp size={12} className={`${saldoMins >= 0 ? "text-[#5B9B7A]/70 group-hover:text-[#5B9B7A]" : "text-[#C96B6B]/70 group-hover:text-[#C96B6B]"} transition-colors duration-200 shrink-0`} />
            <span className="text-[11px] text-secondary group-hover:text-primary transition-colors duration-200 flex-1">Saldo atual</span>
            <span className={`text-sm font-bold font-mono tracking-tight ${saldoMins >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}>
              {saldoDisplay}
            </span>
          </div>
        </div>
      </div>

      <RegisterModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditDate(undefined) }}
        onSave={(fd) => { setEditModalOpen(false); setEditDate(undefined); onSave(fd) }}
        editDate={editDate}
      />

      <JustificacaoModal
        open={justificarOpen}
        onClose={() => setJustificarOpen(false)}
        onSave={(data) => { setJustificarOpen(false); onJustificar(data) }}
        defaultDate={justificarDate}
      />
    </div>
  )
}
