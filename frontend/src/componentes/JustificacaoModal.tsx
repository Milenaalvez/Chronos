import { useState, useRef } from "react"
import { X, Paperclip } from "lucide-react"
import type { Justificacao } from "../types"

interface JustificacaoModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Justificacao) => void
  defaultDate: string
}

const JUSTIFICATIVAS = [
  "Atestado médico",
  "Falta justificada",
  "Férias",
  "Folga",
  "Profissional ainda não contratado",
  "Usuário novo / onboarding",
  "Problema no sistema",
  "Licença",
  "Ausência autorizada",
  "Outro",
]

export function JustificacaoModal({ open, onClose, onSave, defaultDate }: JustificacaoModalProps) {
  const [motivo, setMotivo] = useState("")
  const [observacao, setObservacao] = useState("")
  const [dataInicio, setDataInicio] = useState(defaultDate)
  const [dataFim, setDataFim] = useState(defaultDate)
  const [anexoNome, setAnexoNome] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setAnexoNome(file.name)
  }

  function handleSave() {
    if (!motivo) return
    const autoApprove = [
      "Usuário novo / onboarding",
      "Profissional ainda não contratado",
      "Problema no sistema",
    ]
    const status = autoApprove.includes(motivo) ? "aprovado" : "em_analise"
    onSave({ motivo, observacao, anexoNome, dataInicio, dataFim, status })
  }

  const isValid = motivo && dataInicio && dataFim && dataInicio <= dataFim

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-default/40 rounded-xl p-5 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-lg font-bold text-primary tracking-tight">Justificar ausência ou pendência</h2>
          <p className="text-sm text-secondary">Registre a justificativa para os dias pendentes.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface border border-default/50 text-sm text-primary outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface border border-default/50 text-sm text-primary outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface border border-default/50 text-sm text-primary outline-none focus:border-[var(--accent-hover)] transition-all duration-200 appearance-none"
            >
              <option value="" disabled>Selecione um motivo</option>
              {JUSTIFICATIVAS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {motivo === "Atestado médico" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Anexar documento</label>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-3 w-full h-10 px-3 rounded-lg bg-surface border border-default/50 text-sm text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
              >
                <Paperclip size={14} strokeWidth={2} />
                <span>{anexoNome || "Selecionar arquivo (PDF, imagem)"}</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Descreva o motivo da ausência..."
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-default/50 text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-hover)] transition-all duration-200 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg bg-surface border border-default/50 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Salvar Justificativa
          </button>
        </div>
      </div>
    </div>
  )
}
