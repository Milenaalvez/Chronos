import { useState, useMemo } from "react"
import { ChevronDown, PencilLine } from "lucide-react"
import type { TimeRecord } from "../types"


interface WeekDay {
  day: string
  hours: number
}

interface MetaSemanalProps {
  weekDays: WeekDay[]
  monthTotalMins: number
  monthRecords: TimeRecord[]
}

const maxBarHours = 10
const monthTarget = 176

export function MetaSemanal({ weekDays, monthTotalMins, monthRecords }: MetaSemanalProps) {
  const [mode, setMode] = useState<"semanal" | "mensal">("semanal")
  const [showDropdown, setShowDropdown] = useState(false)
  const [meta, setMeta] = useState(40)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(meta))

  const weekTotal = useMemo(() => weekDays.reduce((acc, d) => acc + d.hours, 0), [weekDays])
  const monthTotal = monthTotalMins / 60

  const isSemanal = mode === "semanal"
  const target = isSemanal ? meta : monthTarget
  const total = isSemanal ? weekTotal : monthTotal
  const extra = Math.max(total - target, 0)
  const progress = Math.min((total / target) * 100, 100)

  function handleSave() {
    const parsed = Number(editValue)
    if (!isNaN(parsed) && parsed > 0) {
      setMeta(parsed)
    }
    setEditing(false)
  }

  const titleLabel = isSemanal ? "Semanal" : "Mensal"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold text-primary">Meta {titleLabel}</h3>
          {isSemanal && (
            <button
              onClick={() => { setEditValue(String(meta)); setEditing(true) }}
              className="w-5 h-5 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <PencilLine size={11} strokeWidth={2} />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowDropdown((p) => !p)}
              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
            >
              <ChevronDown size={10} strokeWidth={2} />
            </button>
            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 w-24 rounded-md bg-surface border border-default/40 overflow-hidden z-10">
                {(["semanal", "mensal"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setMode(opt); setShowDropdown(false) }}
                    className={`w-full px-3 py-2 text-[11px] font-medium text-left transition-all duration-200 ${
                      mode === opt ? "text-[var(--accent-hover)] bg-[var(--accent-hover)]/8" : "text-secondary hover:text-primary hover:bg-elevated"
                    }`}
                  >
                    {opt === "semanal" ? "Semanal" : "Mensal"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-secondary">
            {total.toFixed(1)}h / {target}h
          </span>
          {extra > 0 && (
            <span className="text-[11px] font-bold text-[#5B9B7A]">+{extra.toFixed(1)}h</span>
          )}
        </div>
      </div>

      {editing && isSemanal && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-elevated/50">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Carga horária semanal (h)</label>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
              className="w-full h-8 px-2 rounded bg-surface border border-default/40 text-sm text-primary outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
              autoFocus
            />
          </div>
          <button
            onClick={handleSave}
            className="h-8 px-3 rounded bg-[var(--accent-primary)] text-[11px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 shrink-0"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="h-8 px-3 rounded bg-surface border border-default/40 text-[11px] font-medium text-secondary hover:text-primary transition-all duration-200 shrink-0"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="w-full bg-elevated/40 rounded-full h-1 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent-hover)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {isSemanal ? (
        <div className="grid grid-cols-5 gap-3 flex-1 items-end">
          {weekDays.map((d) => (
            <div key={d.day} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{d.day}</span>
              <div className="w-full flex flex-col items-center gap-1">
                <div className="w-full rounded-md bg-elevated/40 relative overflow-hidden" style={{ height: "80px" }}>
                  <div
                    className="absolute bottom-0 left-0 w-full rounded-md transition-all duration-500"
                    style={{
                      height: `${(d.hours / maxBarHours) * 100}%`,
                      minHeight: d.hours > 0 ? "3px" : "0px",
                      backgroundColor: d.hours > 8 ? "#5B9B7A" : "var(--accent-hover)",
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono font-medium text-secondary">{d.hours.toFixed(1)}h</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 flex-1 items-end">
          {(() => {
            const weekMap = new Map<string, number>()
            for (const r of monthRecords) {
              const d = new Date(r.dataISO + "T12:00:00")
              const weekStart = new Date(d)
              weekStart.setDate(d.getDate() - d.getDay() + 1)
              const key = weekStart.toISOString().split("T")[0]
              weekMap.set(key, (weekMap.get(key) || 0) + r.totalHours)
            }
            const sorted = [...weekMap.keys()].sort()
            const maxVal = Math.max(...weekMap.values(), 1)
            return sorted.slice(-4).map((k) => {
              const d = new Date(k + "T12:00:00")
              const label = `${d.getDate()}/${d.getMonth() + 1}`
              return { label, hours: weekMap.get(k) || 0 }
            }).map((w) => (
              <div key={w.label} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{w.label}</span>
                <div className="w-full flex flex-col items-center gap-1">
                  <div className="w-full rounded-md bg-elevated/40 relative overflow-hidden" style={{ height: "80px" }}>
                    <div
                      className="absolute bottom-0 left-0 w-full rounded-md transition-all duration-500"
                      style={{
                        height: `${(w.hours / maxVal) * 100}%`,
                        minHeight: w.hours > 0 ? "3px" : "0px",
                        backgroundColor: "var(--accent-hover)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-medium text-secondary">{w.hours.toFixed(1)}h</span>
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            Carga {isSemanal ? "Semanal" : "Mensal"}
          </span>
          <span className="text-xl font-bold text-primary">{target}h</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Realizado</span>
          <span className="text-xl font-bold text-primary">{total.toFixed(1)}h</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            {extra > 0 ? "Extras" : "Restante"}
          </span>
          <span className={`text-xl font-bold ${extra > 0 ? "text-[#5B9B7A]" : "text-primary"}`}>
            {extra > 0 ? `+${extra.toFixed(1)}h` : `${(target - total).toFixed(1)}h`}
          </span>
        </div>
      </div>
    </div>
  )
}
