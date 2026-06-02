import { Calendario } from "../componentes/Calendario"
import type { TimeRecord, Justificacao, FormData, PageAction } from "../types"

interface CalendarioPageProps {
  records: TimeRecord[]
  allRecords: TimeRecord[]
  onEdit: (dataISO: string) => void
  onSave: (fd: FormData) => void
  justificacoes: Record<string, Justificacao>
  onJustificar: (data: Justificacao) => void
  pageAction?: PageAction | null
  onClearAction?: () => void
}

export function CalendarioPage({ records, allRecords, onEdit, onSave, justificacoes, onJustificar, pageAction, onClearAction }: CalendarioPageProps) {
  return (
    <Calendario
      records={records}
      allRecords={allRecords}
      onEdit={onEdit}
      onSave={onSave}
      justificacoes={justificacoes}
      onJustificar={onJustificar}
      pageAction={pageAction}
      onClearAction={onClearAction}
    />
  )
}
