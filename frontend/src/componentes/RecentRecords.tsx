import { PencilLine } from "lucide-react"
import type { TimeRecord } from "../types"

interface RecentRecordsProps {
  records: TimeRecord[]
  onEdit: (dataISO: string) => void
  onNavigate?: (page: string) => void
}

const tipoStyle: Record<string, string> = {
  Normal: "bg-[#5B9B7A]/10 text-[#5B9B7A]",
  Extra: "bg-[#8AAEE0]/10 text-[#8AAEE0]",
  Compensação: "bg-[#8AAEE0]/10 text-[#8AAEE0]",
  Negativo: "bg-[#C96B6B]/10 text-[#C96B6B]",
  Afastamento: "bg-[#C96B6B]/10 text-[#C96B6B]",
  Pendente: "bg-[#C49A6B]/10 text-[#C49A6B]",
}

export function RecentRecords({ records, onEdit, onNavigate }: RecentRecordsProps) {
  const weekdays = records.filter((r) => {
    if (!r.dataISO) return false
    const d = new Date(r.dataISO + "T12:00:00")
    if (isNaN(d.getTime())) return false
    return d.getDay() !== 0 && d.getDay() !== 6
  })
  const sorted = [...weekdays].sort((a, b) => (b.dataISO || '').localeCompare(a.dataISO || '')).slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3">
        <h3 className="text-sm font-semibold text-primary">Registros Recentes</h3>
        <span className="w-14" />
        <span className="w-14" />
        <span className="w-14" />
        <span className="w-16 flex justify-center">
          <button onClick={() => onNavigate?.("registros")} className="text-[10px] font-medium text-[#8AAEE0] hover:text-[#8AAEE0] transition-colors">Ver todos</button>
        </span>
        <span className="w-7" />
      </div>
      <div className="flex flex-col">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-0 pb-2 text-[10px] font-medium text-muted uppercase tracking-wider">
          <span>Data</span>
          <span className="w-14 text-center">Entrada</span>
          <span className="w-14 text-center">Saída</span>
          <span className="w-14 text-center">Total</span>
          <span className="w-16 text-center">Tipo</span>
          <span className="w-7" />
        </div>
        {sorted.map((r) => {
          const semBatida = r.tipo === "Pendente" && r.entrada === "---"
          const displayTipo = semBatida ? "Pendente" : r.totalHours < 8 ? "Negativo" : r.tipo
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-0 py-2.5 items-center transition-all duration-200 hover:bg-elevated/20 rounded -mx-0.5 px-0.5"
            >
              <span className={`text-sm font-medium ${semBatida ? "text-[#C49A6B]" : "text-primary"}`}>
                {r.data}
              </span>
              <span className="w-14 text-center text-sm text-secondary font-mono tracking-wide">
                {semBatida ? "---" : r.entrada}
              </span>
              <span className="w-14 text-center text-sm text-secondary font-mono tracking-wide">
                {semBatida ? "---" : r.saida}
              </span>
              <span className="w-14 text-center text-sm text-secondary font-mono tracking-wide">
                {semBatida ? "---" : r.total}
              </span>
              <span className="w-16 flex justify-center">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tipoStyle[displayTipo]}`}>
                  {displayTipo}
                </span>
              </span>
              <span className="w-7 flex justify-center">
                {semBatida ? (
                  <button
                    onClick={() => onEdit(r.dataISO)}
                    className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-[#C49A6B] hover:bg-[#C49A6B]/8 transition-all duration-200"
                    title="Preencher registro"
                  >
                    <PencilLine size={12} strokeWidth={2} />
                  </button>
                ) : null}
              </span>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p className="text-sm text-muted text-center py-8">Nenhum registro encontrado.</p>
        )}
      </div>
    </div>
  )
}
