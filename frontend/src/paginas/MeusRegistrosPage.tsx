import type { TimeRecord, FormData, Justificacao } from "../types"
import { PageHeader } from "../componentes/PageHeader"
import { RegistrosPage } from "./RegistrosPage"

interface MeusRegistrosPageProps {
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
  onEdit: (dataISO: string) => void
  onSave: (fd: FormData) => void
  onJustificar: (data: Justificacao) => void
  onDelete: (dataISO: string) => void
}

export function MeusRegistrosPage({ allRecords, justificacoes, onEdit, onSave, onJustificar, onDelete }: MeusRegistrosPageProps) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Meus Registros"
        subtitle="Acompanhe seus registros de ponto"
      />

      <RegistrosPage
        allRecords={allRecords}
        justificacoes={justificacoes}
        onEdit={onEdit}
        onSave={onSave}
        onJustificar={onJustificar}
        onDelete={onDelete}
        headerless
      />
    </div>
  )
}
