import { useState } from "react"
import { ClipboardList, FileText, ShieldCheck, Activity } from "lucide-react"
import type { TimeRecord, FormData, Justificacao } from "../types"
import { PageHeader } from "../componentes/PageHeader"
import { RegistrosPage } from "./RegistrosPage"
import { JustificativasPage } from "./JustificativasPage"
import { EmAnalisePage } from "./EmAnalisePage"
import { AuditoriaPage } from "./AuditoriaPage"

const TABS = [
  { key: "registros", label: "Registros", icon: ClipboardList },
  { key: "justificativas", label: "Justificativas", icon: FileText },
  { key: "em-analise", label: "Em Análise", icon: ShieldCheck },
  { key: "auditoria", label: "Auditoria", icon: Activity },
] as const

type TabKey = (typeof TABS)[number]["key"]

interface MeusRegistrosPageProps {
  allRecords: TimeRecord[]
  justificacoes: Record<string, Justificacao>
  onEdit: (dataISO: string) => void
  onSave: (fd: FormData) => void
  onJustificar: (data: Justificacao) => void
  onDelete: (dataISO: string) => void
}

export function MeusRegistrosPage({ allRecords, justificacoes, onEdit, onSave, onJustificar, onDelete }: MeusRegistrosPageProps) {
  const [tab, setTab] = useState<TabKey>("registros")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Meus Registros"
        subtitle="Acompanhe seus registros de ponto, justificativas e auditoria"
      />

      <div className="flex items-center gap-1 border-b border-default/30 overflow-x-auto flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 ${
                isActive
                  ? "border-[var(--accent-primary)] text-primary"
                  : "border-transparent text-muted hover:text-secondary hover:border-default/30"
              }`}
            >
              <Icon size={13} strokeWidth={2} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "registros" && (
        <RegistrosPage
          allRecords={allRecords}
          justificacoes={justificacoes}
          onEdit={onEdit}
          onSave={onSave}
          onJustificar={onJustificar}
          onDelete={onDelete}
          headerless
        />
      )}
      {tab === "justificativas" && <JustificativasPage />}
      {tab === "em-analise" && <EmAnalisePage />}
      {tab === "auditoria" && <AuditoriaPage />}
    </div>
  )
}
