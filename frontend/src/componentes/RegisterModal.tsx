import { useRef, useState, useEffect } from "react"
import { X, Clock, AlertCircle, Send, LogIn, Coffee, Undo2, LogOut } from "lucide-react"
import type { FormData } from "../types"
import { toMinutes } from "../types"

interface RegisterModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: FormData) => void
  editDate?: string
}

function nowISO() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function getDeadlineDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return formatDateBR(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
}

export function RegisterModal({ open, onClose, onSave, editDate }: RegisterModalProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState("")
  const [quickMode, setQuickMode] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) { setError(""); setQuickMode(false); setMotivo(""); setSubmitted(false) }
  }, [open])

  if (!open) return null

  const isEditing = !!editDate

  function validate(fd: FormData): string | null {
    if (fd.data > todayISO()) return "Não é possível registrar horários no futuro."

    if (quickMode) {
      if (fd.data === todayISO()) {
        const now = nowISO()
        if (fd.entrada > now) return "Horário de entrada não pode estar no futuro."
      }
      return null
    }

    if (fd.data === todayISO()) {
      const now = nowISO()
      if (fd.entrada > now) return "Horário de entrada não pode estar no futuro."
      if (fd.saidaIntervalo && fd.saidaIntervalo > now) return "Horário de saída para intervalo não pode estar no futuro."
      if (fd.retornoIntervalo && fd.retornoIntervalo > now) return "Horário de retorno não pode estar no futuro."
      if (fd.saida && fd.saida > now) return "Horário de saída não pode estar no futuro."
    }

    const e = toMinutes(fd.entrada)
    const si = toMinutes(fd.saidaIntervalo || "12:00")
    const ri = toMinutes(fd.retornoIntervalo || "13:00")
    const s = toMinutes(fd.saida || "17:00")

    if (si <= e) return "Saída para intervalo deve ser após a entrada."
    if (ri <= si) return "Retorno do intervalo deve ser após a saída para intervalo."
    if (s <= ri) return "Saída deve ser após o retorno do intervalo."

    if (isEditing && motivo.trim().length < 20) return "Descreva o motivo da alteração (mínimo 20 caracteres)."

    return null
  }

  const charCount = motivo.length
  const deadlineDate = getDeadlineDate()

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md mx-4 bg-surface shadow-modal rounded-xl p-6 animate-in fade-in zoom-in duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--accent-primary)]/8 mb-4">
              <Send size={24} className="text-[var(--accent-primary)]" />
            </div>
            <h2 className="text-lg font-bold text-primary tracking-tight">Solicitação enviada</h2>
            <p className="text-sm text-secondary mt-2 leading-relaxed">
              Sua solicitação foi encaminhada para análise. Você será notificado quando o RH ou gestor concluir a avaliação.
            </p>
          </div>
          <div className="mt-4 rounded-lg bg-elevated border border-default/10 p-3 flex items-center gap-2">
            <AlertCircle size={12} className="text-[#C49A6B]" />
            <span className="text-[11px] text-secondary font-medium">Aguardando aprovação do RH</span>
          </div>
          <button
            onClick={onClose}
            className="w-full h-11 mt-5 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl mx-4 bg-surface shadow-modal rounded-xl p-6 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/[0.07] transition-all duration-200"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col gap-1 mb-5 max-w-2xl">
          <h2 className="text-xl font-bold text-primary tracking-tight">
            {quickMode ? "Bater Ponto" : isEditing ? "Editar Registro" : "Registrar Jornada"}
          </h2>
          <p className="text-sm text-secondary leading-relaxed">
            {quickMode
              ? "Registre apenas sua entrada. Depois você completa com a saída."
              : isEditing
                ? "Solicite a correção dos horários registrados. Todas as alterações serão analisadas antes da aprovação."
                : "Adicione os horários do seu expediente."}
          </p>
        </div>

        {isEditing && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--accent-primary)]/[0.06] border border-[var(--accent-primary)]/[0.15] mb-5">
            <AlertCircle size={14} className="text-[var(--accent-primary)] shrink-0" strokeWidth={2} />
            <p className="text-[11px] text-secondary leading-relaxed">
              As alterações serão enviadas para análise do RH e/ou Gestor.{" "}
              <strong className="text-primary">Prazo para solicitação:</strong> até 1 dia antes do fechamento da folha de pagamento.
            </p>
          </div>
        )}

        {!editDate && (
          <button
            type="button"
            onClick={() => setQuickMode(!quickMode)}
            className="flex items-center gap-2 mb-5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              backgroundColor: quickMode ? 'rgba(98, 142, 203, 0.1)' : 'transparent',
              color: quickMode ? 'var(--accent-primary)' : 'var(--color-text-secondary, #94A3B8)',
              border: quickMode ? '1px solid rgba(98, 142, 203, 0.3)' : '1px solid transparent',
            }}
          >
            <Clock size={12} strokeWidth={2} />
            {quickMode ? "Modo completo" : "Bater Ponto (só entrada)"}
          </button>
        )}

        <form
          ref={formRef}
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const data: FormData = {
              data: fd.get("data") as string,
              entrada: fd.get("entrada") as string,
              saidaIntervalo: quickMode ? "" : (fd.get("saidaIntervalo") as string || "12:00"),
              retornoIntervalo: quickMode ? "" : (fd.get("retornoIntervalo") as string || "13:00"),
              saida: fd.get("saida") as string || "",
              motivo: isEditing ? motivo : undefined,
            }
            const err = validate(data)
            if (err) {
              setError(err)
              return
            }
            setError("")
            if (isEditing) {
              setSubmitted(true)
              return
            }
            onSave(data)
          }}
        >
          {isEditing ? (
            <div className="grid grid-cols-[1fr_360px] gap-6">
              {/* ─── LEFT COLUMN: Data + Horários ─── */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Data</label>
                  <input
                    name="data"
                    type="date"
                    defaultValue={editDate ?? todayISO()}
                    className="w-full h-10 px-3 rounded-lg bg-elevated border border-default/10 text-sm text-primary placeholder-[#64748B] outline-none focus:border-default/30 transition-all duration-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Entrada</label>
                    <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                      <LogIn size={14} className="text-green-400 shrink-0" />
                      <input
                        name="entrada"
                        type="time"
                        defaultValue={nowISO()}
                        className="flex-1 bg-transparent text-sm text-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Saída Intervalo</label>
                    <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                      <Coffee size={14} className="text-yellow-400 shrink-0" />
                      <input
                        name="saidaIntervalo"
                        type="time"
                        defaultValue="12:00"
                        className="flex-1 bg-transparent text-sm text-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Retorno Intervalo</label>
                    <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                      <Undo2 size={14} className="text-blue-400 shrink-0" />
                      <input
                        name="retornoIntervalo"
                        type="time"
                        defaultValue="13:00"
                        className="flex-1 bg-transparent text-sm text-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Saída</label>
                    <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                      <LogOut size={14} className="text-red-400 shrink-0" />
                      <input
                        name="saida"
                        type="time"
                        defaultValue="17:00"
                        className="flex-1 bg-transparent text-sm text-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── RIGHT COLUMN: Motivo + Resumo + Prazo ─── */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Motivo da solicitação</label>
                    <span className={`text-[10px] font-medium ${charCount >= 20 ? "text-[#5B9B7A]" : charCount > 0 ? "text-[#C49A6B]" : "text-muted"}`}>
                      {charCount}/500
                    </span>
                  </div>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva detalhadamente o motivo da correção."
                    rows={5}
                    maxLength={500}
                    className="w-full h-full min-h-[100px] px-3 py-2.5 rounded-lg bg-elevated border border-default/10 text-sm text-primary placeholder-muted outline-none focus:border-default/30 transition-all duration-200 resize-none"
                  />
                  {charCount > 0 && charCount < 20 && (
                    <p className="text-[10px] text-[#C49A6B] font-medium">Mínimo de 20 caracteres</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-elevated border border-default/10 p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted uppercase tracking-wider font-semibold">Data</span>
                    <span className="text-xs font-semibold text-primary">{editDate ? formatDateBR(editDate) : ""}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted uppercase tracking-wider font-semibold">Horários Alterados</span>
                    <span className="text-xs font-semibold text-primary">4</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted uppercase tracking-wider font-semibold">Status</span>
                    <span className="text-xs font-semibold text-[#C49A6B]">Aguardando Análise</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted uppercase tracking-wider font-semibold">Aprovador</span>
                    <span className="text-xs font-semibold text-primary">RH / Gestor</span>
                  </div>
                </div>

                <div className="rounded-lg bg-elevated border border-default/10 p-3 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-muted uppercase tracking-wider font-semibold">Prazo Limite</span>
                    <span className="text-xs font-semibold text-primary">{deadlineDate}</span>
                  </div>
                  <span className="text-xs font-semibold font-mono text-[#C49A6B]">23:59</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Data</label>
                <input
                  name="data"
                  type="date"
                  defaultValue={editDate ?? todayISO()}
                  className="w-full h-10 px-3 rounded-lg bg-elevated border border-default/10 text-sm text-primary placeholder-[#64748B] outline-none focus:border-default/30 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Entrada</label>
                <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                  <LogIn size={14} className="text-green-400 shrink-0" />
                  <input
                    name="entrada"
                    type="time"
                    defaultValue={nowISO()}
                    className="flex-1 bg-transparent text-sm text-primary outline-none"
                  />
                </div>
              </div>

              {!quickMode && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Saída Intervalo</label>
                      <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                        <Coffee size={14} className="text-yellow-400 shrink-0" />
                        <input
                          name="saidaIntervalo"
                          type="time"
                          defaultValue="12:00"
                          className="flex-1 bg-transparent text-sm text-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Retorno Intervalo</label>
                      <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                        <Undo2 size={14} className="text-blue-400 shrink-0" />
                        <input
                          name="retornoIntervalo"
                          type="time"
                          defaultValue="13:00"
                          className="flex-1 bg-transparent text-sm text-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Saída</label>
                    <div className="flex items-center gap-2.5 px-3 h-10 rounded-lg bg-elevated border border-default/10">
                      <LogOut size={14} className="text-red-400 shrink-0" />
                      <input
                        name="saida"
                        type="time"
                        defaultValue="17:00"
                        className="flex-1 bg-transparent text-sm text-primary outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-[#C96B6B]/8">
              <p className="text-xs font-medium text-[#C96B6B]">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-lg bg-elevated border border-default/10 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
                disabled={isEditing && charCount < 20}
              >
                {quickMode ? "Registrar Entrada" : isEditing ? "Enviar para Análise" : "Salvar Registro"}
              </button>
            </div>
            {isEditing && (
              <p className="text-[10px] text-muted text-center">
                As alterações não serão aplicadas automaticamente. Toda solicitação será analisada pelo responsável.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
