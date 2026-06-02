import { useState } from "react"
import { Check, X, Loader2 } from "lucide-react"

interface TermsOfUseModalProps {
  onAccept: () => Promise<void>
  onClose?: () => void
}

export function TermsOfUseModal({ onAccept, onClose }: TermsOfUseModalProps) {
  const [terms1, setTerms1] = useState(false)
  const [terms2, setTerms2] = useState(false)
  const [terms3, setTerms3] = useState(false)
  const [loading, setLoading] = useState(false)

  const allChecked = terms1 && terms2 && terms3

  const handleAccept = async () => {
    if (!allChecked) return
    setLoading(true)
    try {
      await onAccept()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl mx-4 bg-surface border border-default/20 rounded-xl shadow-xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-default/10">
          <div>
            <h2 className="text-lg font-bold text-primary tracking-tight">Termos de Uso e Consentimentos</h2>
            <p className="text-xs text-secondary mt-0.5">Para continuar, leia e aceite os termos abaixo</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="md:w-11 md:h-11 w-10 h-10 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-elevated transition-all duration-200">
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs text-secondary leading-relaxed">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">1. Termos de Uso do Sistema</h3>
            <p>Ao utilizar o Chronos, você concorda com as regras estabelecidas pela empresa para registro de jornada de trabalho. O sistema é uma ferramenta oficial de controle de ponto eletrônico e todos os registros têm valor legal para efeitos trabalhistas.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">2. Política de Privacidade</h3>
            <p>Seus dados pessoais são tratados com confidencialidade e armazenados em conformidade com a Lei Geral de Proteção de Dados (LGPD). As informações coletadas são utilizadas exclusivamente para fins de gestão de jornada de trabalho e cumprimento de obrigações trabalhistas.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">3. Tratamento de Dados Pessoais</h3>
            <p>Seus dados de identificação, registro de ponto, localização e biometria facial serão processados e armazenados pelo sistema. Você tem direito de acesso, correção e exclusão dos dados, conforme previsto na LGPD.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">4. Utilização de Geolocalização</h3>
            <p>O sistema coleta dados de localização GPS no momento do registro de ponto para validação da presença do colaborador no local de trabalho. Esses dados são armazenados como parte do registro de auditoria.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">5. Utilização de Imagens para Autenticação Facial</h3>
            <p>O sistema utiliza reconhecimento facial como camada adicional de segurança para validação de identidade durante os registros de ponto. As imagens capturadas são armazenadas de forma segura e utilizadas exclusivamente para fins de autenticação e auditoria.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">6. Armazenamento de Registros para Auditoria</h3>
            <p>Todos os registros de ponto, incluindo dados de localização, dispositivo, foto e resultado de validação facial, são armazenados para fins de auditoria e cumprimento de obrigações legais trabalhistas, conforme legislação vigente.</p>
          </div>

          <div className="border-t border-default/10 pt-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={terms1}
                onChange={(e) => setTerms1(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-default/30 bg-surface accent-[var(--accent-primary)]"
              />
              <span className="text-xs text-secondary group-hover:text-primary transition-colors">
                Li e aceito os <strong className="text-primary">Termos de Uso</strong> do Chronos.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={terms2}
                onChange={(e) => setTerms2(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-default/30 bg-surface accent-[var(--accent-primary)]"
              />
              <span className="text-xs text-secondary group-hover:text-primary transition-colors">
                Estou ciente de que meus registros de ponto poderão armazenar informações de <strong className="text-primary">localização</strong>, <strong className="text-primary">dispositivo</strong> e <strong className="text-primary">auditoria</strong>.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={terms3}
                onChange={(e) => setTerms3(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-default/30 bg-surface accent-[var(--accent-primary)]"
              />
              <span className="text-xs text-secondary group-hover:text-primary transition-colors">
                Autorizo a utilização da minha <strong className="text-primary">imagem para autenticação facial</strong> e validação de identidade durante registros de ponto.
              </span>
            </label>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-default/10">
          <button
            onClick={handleAccept}
            disabled={!allChecked || loading}
            className="w-full h-11 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} strokeWidth={2.5} />
            )}
            {loading ? "Aguarde..." : "Aceitar e Continuar"}
          </button>
        </div>
      </div>
    </div>
  )
}
