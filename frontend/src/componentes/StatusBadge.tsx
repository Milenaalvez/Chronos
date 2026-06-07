import type { TicketStatus } from "../types"
import { TICKET_STATUS_LABELS } from "../types"

const STATUS_STYLES: Record<TicketStatus, { bg: string; text: string; dot: string }> = {
  ABERTO: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  EM_ANALISE: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  AGUARDANDO_RESPOSTA: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  RESOLVIDO: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  ENCERRADO: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-400" },
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.ABERTO
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {TICKET_STATUS_LABELS[status] || status}
    </span>
  )
}
