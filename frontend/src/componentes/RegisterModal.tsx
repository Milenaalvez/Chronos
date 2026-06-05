import { useRef, useState, useEffect } from "react"
import { X, Clock } from "lucide-react"
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

export function RegisterModal({ open, onClose, onSave, editDate }: RegisterModalProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState("")
  const [quickMode, setQuickMode] = useState(false)

  useEffect(() => {
    if (open) { setError(""); setQuickMode(false) }
  }, [open])

  if (!open) return null

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

    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-surface shadow-modal rounded-xl p-6 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/[0.07] transition-all duration-200"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col gap-1 mb-8">
          <h2 className="text-xl font-bold text-primary tracking-tight">
            {quickMode ? "Bater Ponto" : editDate ? "Editar Registro" : "Registrar Jornada"}
          </h2>
          <p className="text-sm text-secondary">
            {quickMode
              ? "Registre apenas sua entrada. Depois você completa com a saída."
              : editDate
                ? "Corrija os horários do expediente."
                : "Adicione os horários do seu expediente."}
          </p>
        </div>

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
            }
            const err = validate(data)
            if (err) {
              setError(err)
              return
            }
            setError("")
            onSave(data)
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Data</label>
            <input
              name="data"
              type="date"
              defaultValue={editDate ?? todayISO()}
              className="w-full h-10 px-3 rounded-lg bg-surface border border-default/20 text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Entrada</label>
            <input
              name="entrada"
              type="time"
              defaultValue={nowISO()}
              className="w-full h-10 px-3 rounded-lg bg-surface border border-default/20 text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
            />
          </div>

          {!quickMode && (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Saída Intervalo</label>
                  <input
                    name="saidaIntervalo"
                    type="time"
                    defaultValue="12:00"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-default/20 text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Retorno Intervalo</label>
                  <input
                    name="retornoIntervalo"
                    type="time"
                    defaultValue="13:00"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-default/20 text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Saída</label>
                <input
                  name="saida"
                  type="time"
                  defaultValue="17:00"
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-default/20 text-sm text-primary placeholder-[#64748B] outline-none focus:border-[var(--accent-hover)] transition-all duration-200"
                  />
                </div>
              </>
            )}

            {error && (
            <div className="px-3 py-2 rounded-lg bg-[#C96B6B]/8">
              <p className="text-xs font-medium text-[#C96B6B]">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
            className="flex-1 h-11 rounded-lg bg-surface border border-default/20 text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-all duration-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-all duration-200"
            >
              {quickMode ? "Registrar Entrada" : editDate ? "Atualizar Registro" : "Salvar Registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
