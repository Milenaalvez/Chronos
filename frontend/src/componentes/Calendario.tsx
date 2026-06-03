import { useState, useMemo, useEffect, useRef } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import listPlugin from "@fullcalendar/list"
import ptBrLocale from "@fullcalendar/core/locales/pt-br"
import type { EventClickArg, EventContentArg, DatesSetArg } from "@fullcalendar/core"
import type { EventInput } from "@fullcalendar/core"
import {
  ChevronLeft, ChevronRight, Clock, CalendarCheck, AlertTriangle, TrendingUp, ShieldCheck,
  LogIn, LogOut, Coffee, Undo2, X,
} from "lucide-react"
import type { TimeRecord, Justificacao, PageAction } from "../types"
import { formatMinutes } from "../types"
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

const todayISO = () => new Date().toISOString().split("T")[0]
const today = todayISO()
const STD_DAY_MINS = 480

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]

export function Calendario({ records: _records, allRecords, onEdit: _onEdit, onSave, justificacoes, onJustificar, pageAction, onClearAction }: CalendarioProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [selectedISO, setSelectedISO] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editDate, setEditDate] = useState<string | undefined>(undefined)
  const [justificarOpen, setJustificarOpen] = useState(false)
  const [justificarDate, setJustificarDate] = useState("")
  const [currentTitle, setCurrentTitle] = useState("")
  const [view, setView] = useState("dayGridMonth")

  function getRecord(iso: string) {
    return allRecords.find((r) => r.dataISO === iso) ?? null
  }

  function handleDatesSet(arg: DatesSetArg) {
    setCurrentTitle(arg.view.title)
  }

  const fcEvents: EventInput[] = useMemo(() => {
    const events: EventInput[] = []

    for (const r of allRecords) {
      if (!r.dataISO || r.tipo === "Pendente") continue

      const isOngoing = !r.saida || r.saida === "---"
      const totalMins = r.totalHours ? Math.round(r.totalHours * 60) : 0
      const isExtra = !isOngoing && totalMins > STD_DAY_MINS
      const isJustified = !!justificacoes[r.dataISO]

      let color = "#22C55E"
      let title = ""

      if (isJustified) {
        color = "#F59E0B"
        title = "Justificado"
      } else if (isOngoing) {
        color = "#3B82F6"
        title = `${r.entrada || "---"} - Em andamento`
      } else if (isExtra) {
        color = "#A855F7"
        title = `${r.entrada || "---"} - ${r.saida || "---"}`
      } else {
        title = `${r.entrada || "---"} - ${r.saida || "---"}`
      }

      events.push({
        id: r.id || r.dataISO,
        title,
        start: r.dataISO,
        allDay: true,
        color,
        textColor: "#fff",
        extendedProps: { record: r, isOngoing, totalMins, isExtra, isJustified },
      })
    }

    return events
  }, [allRecords, justificacoes])

  const dayDetail = useMemo(() => {
    if (!selectedISO) return null
    const rec = getRecord(selectedISO)
    const d = new Date(selectedISO + "T12:00:00")
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const isFuture = selectedISO > today
    const isJustified = !isWeekend && !isFuture && !!justificacoes[selectedISO]
    const isMissing = !isWeekend && !isFuture && !isJustified && (!rec || rec.tipo === "Pendente")
    const isComplete = !isWeekend && !isFuture && !isJustified && rec != null && rec.tipo !== "Pendente"
    const isOngoing = isComplete && (!rec.saida || rec.saida === "---")
    const weekday = WEEKDAY_NAMES[d.getDay()]
    const [y, m, dayNum] = selectedISO.split("-")
    return {
      iso: selectedISO,
      label: `${weekday}, ${dayNum}/${m}/${y}`,
      isWeekend, isFuture, isJustified, isMissing, isComplete, isOngoing,
      record: rec,
      statusText: isWeekend ? "Fim de semana" : isFuture ? "Futuro" : isJustified
        ? justificacoes[selectedISO]?.status === "aprovado" ? "Falta justificada"
          : justificacoes[selectedISO]?.status === "recusado" ? "Justificativa recusada"
          : "Em análise"
        : isMissing ? "Ausente"
        : isOngoing ? "Em andamento"
        : "Completo",
      statusColor: isWeekend || isFuture ? "text-blue-400" : isJustified
        ? justificacoes[selectedISO]?.status === "aprovado" ? "text-green-400"
          : justificacoes[selectedISO]?.status === "recusado" ? "text-red-400"
          : "text-yellow-400"
        : isMissing ? "text-red-400"
        : isOngoing ? "text-blue-400"
        : "text-green-400",
      badgeBg: isWeekend || isFuture ? "bg-blue-500/8" : isJustified
        ? justificacoes[selectedISO]?.status === "aprovado" ? "bg-green-500/8"
          : justificacoes[selectedISO]?.status === "recusado" ? "bg-red-500/8"
          : "bg-yellow-500/8"
        : isMissing ? "bg-red-500/8"
        : isOngoing ? "bg-blue-500/8"
        : "bg-green-500/8",
      badgeText: isWeekend || isFuture ? "text-blue-400" : isJustified
        ? justificacoes[selectedISO]?.status === "aprovado" ? "text-green-400"
          : justificacoes[selectedISO]?.status === "recusado" ? "text-red-400"
          : "text-yellow-400"
        : isMissing ? "text-red-400"
        : isOngoing ? "text-blue-400"
        : "text-green-400",
      justificacao: isJustified ? justificacoes[selectedISO] : null,
      totalMins: rec?.totalHours ? Math.round(rec.totalHours * 60) : 0,
      saldoMins: rec ? computeDayBalanceMins(rec) : 0,
    }
  }, [selectedISO, allRecords, justificacoes])

  const monthBounds = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${new Date(y, m + 1, 0).getDate()}`
    return { start, end }
  }, [])

  const monthRecords = useMemo(() => filterMonthRecordsStrict(allRecords, monthBounds), [allRecords, monthBounds])
  const monthStats = useMemo(() => computeMonthStats(monthRecords), [monthRecords])

  const daysInMonth = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const days: { iso: string; dayOfWeek: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d)
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      days.push({ iso, dayOfWeek: date.getDay() })
    }
    return days
  }, [])

  const monthWeekdayISOs = useMemo(() => {
    return daysInMonth.filter(d => d.dayOfWeek !== 0 && d.dayOfWeek !== 6 && d.iso <= today).map(d => d.iso)
  }, [daysInMonth])

  const absences = useMemo(() => computeAbsences(allRecords, monthWeekdayISOs, justificacoes), [allRecords, monthWeekdayISOs, justificacoes])
  const abonosCount = useMemo(() => Object.values(justificacoes).filter(j => j.status === "aprovado").length, [justificacoes])

  const saldoMonthRecords = useMemo(() => filterMonthRecords(allRecords, monthBounds), [allRecords, monthBounds])
  const saldoData = useMemo(() => computeSaldo(saldoMonthRecords, justificacoes), [saldoMonthRecords, justificacoes])
  const saldoMins = saldoData.netSaldo

  const insightCards = useMemo(() => [
    { label: "Horas Trabalhadas", value: formatMinutes(monthStats.totalMins), color: "text-blue-400", bg: "bg-blue-500/8", icon: Clock },
    { label: "Banco de Horas", value: `${saldoMins >= 0 ? "+" : ""}${formatMinutes(Math.abs(saldoMins))}`, color: saldoMins >= 0 ? "text-green-400" : "text-red-400", bg: "bg-blue-500/8", icon: TrendingUp },
    { label: "Horas Extras", value: formatMinutes(monthStats.extraMins), color: "text-purple-400", bg: "bg-purple-500/8", icon: TrendingUp },
    { label: "Dias Trabalhados", value: `${monthStats.workedDays}`, color: "text-green-400", bg: "bg-green-500/8", icon: CalendarCheck },
    { label: "Faltas", value: `${absences.faltasCount}`, color: absences.faltasCount > 0 ? "text-red-400" : "text-green-400", bg: absences.faltasCount > 0 ? "bg-red-500/8" : "bg-green-500/8", icon: AlertTriangle },
    { label: "Abonos", value: `${abonosCount}`, color: "text-emerald-400", bg: "bg-emerald-500/8", icon: ShieldCheck },
  ], [monthStats, saldoMins, absences, abonosCount])

  function handleEventClick(arg: EventClickArg) {
    const iso = arg.event.startStr.split("T")[0]
    setSelectedISO(iso)
  }

  function handleDateClick(arg: { dateStr: string }) {
    setSelectedISO(arg.dateStr === selectedISO ? null : arg.dateStr)
  }

  function navigate(direction: "prev" | "next") {
    const api = calendarRef.current?.getApi()
    if (direction === "prev") api?.prev()
    else api?.next()
  }

  function goToday() {
    const api = calendarRef.current?.getApi()
    api?.today()
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    setSelectedISO(iso)
  }

  function changeView(viewName: string) {
    const api = calendarRef.current?.getApi()
    if (api) {
      api.changeView(viewName)
      setView(viewName)
      setCurrentTitle(api.view.title)
    }
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

  function renderEventContent(arg: EventContentArg) {
    const { record, isOngoing, totalMins, isExtra } = arg.event.extendedProps as Record<string, unknown>
    if (!record) {
      return <div className="text-[10px] px-1 py-0.5 text-primary truncate">{arg.event.title}</div>
    }
    return (
      <div className="px-1 py-0.5 leading-tight">
        <div className="text-[10px] font-mono font-bold text-primary truncate">{arg.event.title}</div>
        {!isOngoing && (
          <div className={`text-[8px] font-mono font-semibold ${isExtra ? "text-purple-200" : "text-green-200"}`}>
            {formatMinutes(totalMins as number)}
          </div>
        )}
      </div>
    )
  }

  function DayEvents({ record }: { record: TimeRecord }) {
    if (!record || record.tipo === "Pendente") return null
    const events: { icon: any; label: string; time: string; color: string }[] = []
    if (record.entrada && record.entrada !== "---")
      events.push({ icon: LogIn, label: "Entrada", time: record.entrada, color: "text-green-400" })
    if (record.saidaIntervalo && record.saidaIntervalo !== "---")
      events.push({ icon: Coffee, label: "Intervalo", time: record.saidaIntervalo, color: "text-yellow-400" })
    if (record.retornoIntervalo && record.retornoIntervalo !== "---")
      events.push({ icon: Undo2, label: "Retorno", time: record.retornoIntervalo, color: "text-blue-400" })
    if (record.saida && record.saida !== "---")
      events.push({ icon: LogOut, label: "Saída", time: record.saida, color: "text-red-400" })
    return (
      <div className="space-y-2 mt-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-elevated/40">
            <div className={`w-6 h-6 rounded flex items-center justify-center ${e.color.replace("text-", "bg-")}/10`}>
              <e.icon size={11} className={e.color} />
            </div>
            <span className="text-[11px] font-semibold text-secondary flex-1">{e.label}</span>
            <span className="text-[12px] font-mono font-bold text-primary">{e.time}</span>
          </div>
        ))}
      </div>
    )
  }

  const viewLabels: Record<string, string> = {
    dayGridMonth: "Mês",
    timeGridWeek: "Semana",
    timeGridDay: "Dia",
    listWeek: "Lista",
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <PageHeader
          title="Calendário"
          subtitle="Visualize seus registros de horas no calendário."
          actions={
            <div className="flex items-center gap-2.5">
              <div className="flex rounded-md bg-elevated/40 border border-default/20 p-0.5 gap-px">
                {Object.entries(viewLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => changeView(key)}
                    className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                      view === key
                        ? "bg-blue-500 text-white"
                        : "text-muted hover:text-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={goToday}
                className="h-8 px-3 rounded-md bg-elevated/40 border border-default/20 text-[11px] font-semibold text-secondary hover:text-primary transition-all duration-200"
              >
                Hoje
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {insightCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className={`${card.bg} rounded-xl p-4 flex flex-col gap-1.5`}>
                <span className="text-[9px] font-semibold text-muted uppercase tracking-wider">{card.label}</span>
                <div className="flex items-center gap-2">
                  <Icon size={14} className={card.color} />
                  <span className={`text-sm font-bold font-mono ${card.color}`}>{card.value}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate("prev")} className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/50 transition-all duration-200">
              <ChevronLeft size={14} />
            </button>
            <h2 className="text-base font-bold text-primary min-w-[180px] text-center select-none">{currentTitle}</h2>
            <button onClick={() => navigate("next")} className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/50 transition-all duration-200">
              <ChevronRight size={14} />
            </button>
          </div>
          <span className="text-[11px] text-muted font-medium">
            {monthRecords.length} registro{monthRecords.length !== 1 ? "s" : ""} · {formatMinutes(monthStats.totalMins)} acumuladas
          </span>
        </div>

        <style>{`
          .chronos-calendar {
            --fc-page-bg-color: transparent;
            --fc-border-color: var(--border-default);
            --fc-button-text-color: var(--text-primary);
            --fc-button-bg-color: var(--bg-elevated);
            --fc-button-border-color: var(--border-default);
            --fc-button-hover-bg-color: var(--bg-hover);
            --fc-button-hover-border-color: var(--border-hover);
            --fc-button-active-bg-color: var(--accent-primary);
            --fc-button-active-border-color: var(--accent-primary);
            --fc-event-bg-color: #22C55E;
            --fc-event-border-color: transparent;
            --fc-event-text-color: #fff;
            --fc-today-bg-color: color-mix(in srgb, var(--accent-primary) 8%, transparent);
            --fc-now-indicator-color: var(--accent-primary);
            --fc-list-event-hover-bg-color: var(--bg-elevated);
            --fc-neutral-bg-color: transparent;
            --fc-non-business-color: transparent;
            --fc-highlight-color: color-mix(in srgb, var(--accent-primary) 12%, transparent);
          }
          .chronos-calendar .fc {
            background: transparent;
            color: var(--text-primary);
          }
          .chronos-calendar .fc-header-toolbar {
            display: none;
          }
          .chronos-calendar .fc-toolbar-title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--text-primary);
          }
          .chronos-calendar .fc-col-header-cell {
            background: var(--bg-surface);
            padding: 6px 0;
          }
          .chronos-calendar .fc-col-header-cell-cushion {
            font-size: 10px;
            font-weight: 600;
            color: var(--accent-primary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .chronos-calendar .fc-daygrid-day {
            background: transparent;
            transition: background 0.15s;
          }
          .chronos-calendar .fc-daygrid-day:hover {
            background: var(--bg-elevated);
          }
          .chronos-calendar .fc-daygrid-day-number {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-primary);
            padding: 4px 6px;
          }
          .chronos-calendar .fc-day-today .fc-daygrid-day-number {
            color: var(--accent-primary);
          }
          .chronos-calendar .fc-day-other .fc-daygrid-day-number {
            opacity: 0.3;
          }
          .chronos-calendar .fc-day-other {
            opacity: 0.3;
          }
          .chronos-calendar .fc-daygrid-day-frame {
            min-height: 80px;
            padding: 2px;
          }
          .chronos-calendar .fc-daygrid-day-events {
            margin-top: 2px;
          }
          .chronos-calendar .fc-daygrid-event {
            border-radius: 4px;
            margin: 1px 2px;
            font-size: 10px;
            border: none;
            box-shadow: none;
          }
          .chronos-calendar .fc-daygrid-event:hover {
            opacity: 0.85;
          }
          .chronos-calendar .fc-daygrid-more-link {
            font-size: 10px;
            color: var(--text-muted);
          }
          .chronos-calendar .fc-timegrid-slot {
            height: 32px;
          }
          .chronos-calendar .fc-timegrid-slot-lane {
            background: transparent;
          }
          .chronos-calendar .fc-timegrid-slot-minor {
            border-color: var(--border-default);
          }
          .chronos-calendar .fc-timegrid-slot-lane:hover {
            background: var(--bg-elevated);
          }
          .chronos-calendar .fc-timegrid-col {
            background: transparent;
          }
          .chronos-calendar .fc-timegrid-now-indicator-line {
            border-color: var(--accent-primary);
          }
          .chronos-calendar .fc-timegrid-now-indicator-arrow {
            border-color: var(--accent-primary);
            color: var(--accent-primary);
          }
          .chronos-calendar .fc-list {
            border: none;
            background: transparent;
          }
          .chronos-calendar .fc-list-table {
            background: transparent;
          }
          .chronos-calendar .fc-list-day {
            background: transparent;
          }
          .chronos-calendar .fc-list-day-cushion {
            background: var(--bg-surface) !important;
            padding: 8px 12px;
          }
          .chronos-calendar .fc-list-day-text {
            color: var(--text-primary);
            font-weight: 700;
            font-size: 12px;
          }
          .chronos-calendar .fc-list-day-side-text {
            color: var(--text-muted);
            font-size: 11px;
          }
          .chronos-calendar .fc-list-event {
            background: transparent;
            border-bottom: 1px solid var(--border-default);
          }
          .chronos-calendar .fc-list-event:hover td {
            background: var(--bg-elevated);
          }
          .chronos-calendar .fc-list-event-time {
            color: var(--text-muted);
            font-size: 11px;
          }
          .chronos-calendar .fc-list-event-title {
            color: var(--text-primary);
            font-size: 11px;
          }
          .chronos-calendar .fc-scrollgrid {
            border: 1px solid var(--border-default);
            border-radius: 12px;
            overflow: hidden;
          }
          .chronos-calendar .fc-scrollgrid-section > td {
            border: none;
          }
          .chronos-calendar .fc-scrollgrid-section-header > td {
            border-bottom: 1px solid var(--border-default);
          }
          .chronos-calendar .fc-daygrid-week-number {
            color: var(--text-muted);
            font-size: 10px;
          }
          .chronos-calendar .fc-popover {
            background: var(--bg-surface);
            border: 1px solid var(--border-default);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          }
          .chronos-calendar .fc-popover-header {
            background: var(--bg-elevated);
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            color: var(--text-primary);
          }
          .chronos-calendar .fc-popover-body {
            padding: 4px;
          }
          .chronos-calendar .fc-more-popover-misc {
            color: var(--text-muted);
            font-size: 10px;
          }
          @media (max-width: 640px) {
            .chronos-calendar .fc-daygrid-day-frame {
              min-height: 50px;
            }
            .chronos-calendar .fc-scrollgrid {
              border-radius: 8px;
            }
          }
        `}</style>

        <div className="chronos-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            events={fcEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            datesSet={handleDatesSet}
            height="auto"
            contentHeight="auto"
            aspectRatio={1.35}
            firstDay={0}
            weekends={true}
            locale={ptBrLocale}
            allDayText=""
            noEventsText="Nenhum registro encontrado"
            dayMaxEvents={3}
            dayPopoverFormat={{ weekday: "long", month: "long", day: "numeric" } as any}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            } as any}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            expandRows={true}
            stickyHeaderDates={false}
            nowIndicator={true}
            weekNumbers={false}
            navLinks={false}
            editable={false}
            selectable={false}
            selectMirror={false}
            dayMaxEventRows={true}
            views={{
              timeGridWeek: {
                dayHeaderFormat: { weekday: "short", day: "numeric" } as any,
              },
              timeGridDay: {
                dayHeaderFormat: { weekday: "long", day: "numeric", month: "long" } as any,
              },
              listWeek: {
                listDayFormat: { weekday: "long", month: "long", day: "numeric", year: "numeric" } as any,
                listDaySideFormat: false,
              },
            }}
          />
        </div>
      </div>

      {selectedISO && dayDetail && (
        <div className="w-80 shrink-0 border-l border-default/20 pl-6 hidden lg:block">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-[3px] h-4 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-primary tracking-tight">{dayDetail.label}</h3>
                </div>
              </div>
              <button onClick={() => setSelectedISO(null)} className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-elevated/50 transition-all">
                <X size={12} />
              </button>
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${dayDetail.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${dayDetail.badgeText.replace("text-", "bg-")}`} />
              <span className={`text-[11px] font-semibold ${dayDetail.badgeText}`}>{dayDetail.statusText}</span>
            </div>

            {dayDetail.isComplete && !dayDetail.isJustified && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-elevated/40 rounded-lg p-3">
                  <span className="text-[9px] text-muted uppercase tracking-wider">Trabalhadas</span>
                  <p className="text-sm font-bold font-mono text-primary mt-1">{formatMinutes(dayDetail.totalMins)}</p>
                </div>
                <div className="bg-elevated/40 rounded-lg p-3">
                  <span className="text-[9px] text-muted uppercase tracking-wider">Saldo</span>
                  <p className={`text-sm font-bold font-mono mt-1 ${dayDetail.saldoMins >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {dayDetail.saldoMins >= 0 ? "+" : ""}{formatMinutes(Math.abs(dayDetail.saldoMins))}
                  </p>
                </div>
              </div>
            )}

            {dayDetail.isOngoing && !dayDetail.isJustified && dayDetail.record && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-elevated/40 rounded-lg p-3">
                  <span className="text-[9px] text-muted uppercase tracking-wider">Trabalhadas</span>
                  <p className="text-sm font-bold font-mono text-primary mt-1">{formatMinutes(dayDetail.totalMins)}</p>
                </div>
                <div className="bg-elevated/40 rounded-lg p-3">
                  <span className="text-[9px] text-muted uppercase tracking-wider">Status</span>
                  <p className="text-sm font-bold font-mono text-blue-400 mt-1">Em andamento</p>
                </div>
              </div>
            )}

            {dayDetail.record && dayDetail.record.tipo !== "Pendente" && !dayDetail.isJustified && (
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2 block">Linha do tempo</span>
                <div className="relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-elevated/50" />
                  <DayEvents record={dayDetail.record} />
                </div>
              </div>
            )}

            {dayDetail.isJustified && dayDetail.justificacao && (
              <div className="bg-yellow-500/8 rounded-lg p-3">
                <span className="text-[10px] font-semibold text-yellow-400">Justificativa</span>
                <p className="text-[11px] text-secondary mt-1">{dayDetail.justificacao.observacao || justificacoes[selectedISO]?.motivo}</p>
                <span className="text-[9px] text-muted block mt-1">
                  {dayDetail.justificacao.status === "aprovado" ? "Aprovado" : dayDetail.justificacao.status === "recusado" ? "Recusado" : "Em análise"}
                </span>
              </div>
            )}

            {dayDetail.isMissing && (
              <div className="bg-red-500/8 rounded-lg p-3">
                <p className="text-[11px] text-secondary">Nenhum registro encontrado para este dia.</p>
              </div>
            )}

            {!dayDetail.isWeekend && !dayDetail.isFuture && (
              <button
                onClick={() => handleQuickEdit(dayDetail.iso)}
                className="w-full h-9 rounded-lg bg-blue-500/10 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-all"
              >
                {dayDetail.isMissing || dayDetail.isJustified ? "Justificar falta" : "Editar registro"}
              </button>
            )}
          </div>
        </div>
      )}

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
