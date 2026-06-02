import { useMemo } from "react"
import { Pencil } from "lucide-react"
import type { TimeRecord } from "../types"

type DayStatus = "weekend" | "future" | "missing" | "complete" | "incomplete"

interface JornadaCalendarProps {
  records: TimeRecord[]
  onEdit: (dataISO: string) => void
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

function getCurrentMonthDays() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: { iso: string; day: number; dayOfWeek: number }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    days.push({ iso, day: d, dayOfWeek: date.getDay() })
  }
  return days
}

export function JornadaCalendar({ records, onEdit }: JornadaCalendarProps) {

  const days = useMemo(() => {
    const raw = getCurrentMonthDays()
    const today = new Date().toISOString().split("T")[0]
    return raw.map((d) => {
      if (d.dayOfWeek === 0 || d.dayOfWeek === 6) {
        return { ...d, status: "weekend" as DayStatus, hours: 0, label: "Fim de semana", editable: false }
      }
      if (d.iso > today) {
        return { ...d, status: "future" as DayStatus, hours: 0, label: "Futuro", editable: false }
      }
      const rec = records.find((r) => r.dataISO === d.iso)
      if (!rec || rec.tipo === "Pendente") {
        return { ...d, status: "missing" as DayStatus, hours: 0, label: "Não registrado", editable: true }
      }
      const hours = rec.totalHours
      if (hours >= 8) {
        return { ...d, status: "complete" as DayStatus, hours, label: "Registrado", editable: true }
      }
      return { ...d, status: "incomplete" as DayStatus, hours, label: "Registrado", editable: true }
    })
  }, [records])

  const firstDayOfWeek = days[0]?.dayOfWeek ?? 0
  const leadingEmpties = Array.from({ length: firstDayOfWeek })

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((name) => (
          <div key={name} className="text-center text-[10px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider pb-2">
            {name}
          </div>
        ))}

        {leadingEmpties.map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((d) => {
          const dotColor =
            d.status === "complete" ? "#5B9B7A" :
            d.status === "missing" ? "#C96B6B" :
            d.status === "incomplete" ? "#C49A6B" :
            "var(--accent-primary)"

          const textColor =
            d.status === "weekend" || d.status === "future" ? "text-[var(--accent-primary)]" :
            d.status === "missing" ? "text-[#C96B6B]" :
            "text-[#5B9B7A]"

          return (
            <div
              key={d.iso}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/[0.03] group min-h-[60px]"
            >
              <span className="text-xs font-bold text-primary leading-tight">{d.day}</span>

              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.status === "weekend" || d.status === "future" ? "" : "shadow-sm"}`}
                style={{ backgroundColor: dotColor }}
              />

              {d.status !== "weekend" && d.status !== "future" && (
                <span className={`text-[10px] font-mono font-semibold leading-tight ${d.status === "missing" ? "text-[#C96B6B]" : "text-primary"}`}>
                  {d.hours > 0 ? `${d.hours >= 10 ? d.hours.toFixed(1) : d.hours.toFixed(0)}h` : "0h"}
                </span>
              )}

              <span className={`text-[8px] font-medium leading-tight ${textColor}`}>
                {d.status === "weekend" ? "---" : d.status === "future" ? "---" : d.label === "Registrado" ? "Reg." : "Não"}
              </span>

              <div className="h-3 flex items-center justify-center">
                {d.editable && (
                  <button
                    onClick={() => onEdit(d.iso)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted hover:text-[var(--accent-primary)]"
                    title="Editar registro"
                  >
                    <Pencil size={10} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
