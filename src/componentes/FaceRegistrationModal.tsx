import { useState, useEffect, useRef, useCallback } from "react"
import { Camera, CheckCircle2, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import * as faceapi from "face-api.js"

interface FaceRegistrationModalProps {
  onComplete: (descriptors: number[][], images: string[]) => Promise<void>
  onSkip?: () => void
}

const CAPTURE_STEPS = [
  { label: "Rosto frontal", instruction: "Olhe para frente" },
  { label: "Rosto à esquerda", instruction: "Vire levemente para a esquerda" },
  { label: "Rosto à direita", instruction: "Vire levemente para a direita" },
  { label: "Rosto para cima", instruction: "Olhe levemente para cima" },
  { label: "Rosto para baixo", instruction: "Olhe levemente para baixo" },
]

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

const OVAL_W = 192
const OVAL_H = 224
const CENTER_THRESHOLD = 0.5
const CAPTURE_DELAY_MS = 1200

const DIRECTION_ARROWS: Record<string, { icon: typeof ChevronLeft; label: string }> = {
  left: { icon: ChevronLeft, label: "Vire para a esquerda" },
  right: { icon: ChevronRight, label: "Vire para a direita" },
  up: { icon: ChevronUp, label: "Olhe para cima" },
  down: { icon: ChevronDown, label: "Olhe para baixo" },
}

type FaceStatus = "no-face" | "centered" | "off-center"

export function FaceRegistrationModal({ onComplete, onSkip }: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loadingModels, setLoadingModels] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("no-face")
  const [directionHint, setDirectionHint] = useState<string | null>(null)
  const [showArrow, setShowArrow] = useState<"left" | "right" | "up" | "down" | null>(null)
  const [centeredProgress, setCenteredProgress] = useState(0)
  const capturingRef = useRef(false)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const imagesRef = useRef<string[]>([])
  const descriptorsRef = useRef<number[][]>([])
  const [faceError, setFaceError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadModels() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        if (!cancelled) setModelsLoaded(true)
      } catch (err: any) {
        if (!cancelled) setError("Erro ao carregar modelo facial: " + (err?.message || "desconhecido"))
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }
    loadModels()
    return () => { cancelled = true }
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      setError("Câmera não disponível. Permita o acesso à câmera e tente novamente.")
    }
  }, [])

  useEffect(() => {
    if (modelsLoaded && !done) {
      startCamera()
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [modelsLoaded, done, startCamera])

  const capture = useCallback(async () => {
    if (capturingRef.current) return
    capturingRef.current = true
    setCenteredProgress(0)

    const vid = videoRef.current
    if (!vid || !vid.videoWidth) {
      capturingRef.current = false
      return
    }

    const detection = await faceapi.detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks().withFaceDescriptor()

    if (detection) {
      const canvas = document.createElement("canvas")
      canvas.width = vid.videoWidth
      canvas.height = vid.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) { capturingRef.current = false; return }
      ctx.drawImage(vid, 0, 0)
      const imgData = canvas.toDataURL("image/jpeg", 0.8)

      const desc = Array.from(detection.descriptor)
      imagesRef.current = [...imagesRef.current, imgData]
      descriptorsRef.current = [...descriptorsRef.current, desc]

      if (step < CAPTURE_STEPS.length - 1) {
        setStep((s) => s + 1)
      } else {
        setDone(true)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }
    }
    capturingRef.current = false
  }, [step])

  useEffect(() => {
    if (!modelsLoaded || done) return

    let cancelled = false
    let centeredStart: number | null = null
    let loopTimer: ReturnType<typeof setTimeout> | null = null

    const interval = setInterval(() => {
      if (centeredStart !== null && !capturingRef.current) {
        const elapsed = Date.now() - centeredStart
        setCenteredProgress(Math.min(elapsed / CAPTURE_DELAY_MS, 0.99))
      } else {
        setCenteredProgress(0)
      }
    }, 80)
    progressIntervalRef.current = interval

    async function loop() {
      if (cancelled || done || capturingRef.current) return

      const vid = videoRef.current
      if (!vid || !vid.videoWidth) {
        if (!cancelled) loopTimer = setTimeout(() => loop(), 500)
        return
      }

      try {
        setDetecting(true)

        const detection = await faceapi.detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks()

        const container = containerRef.current
        const vw = vid.videoWidth
        const vh = vid.videoHeight

        if (detection && container) {
          const rect = container.getBoundingClientRect()
          const scaleX = rect.width / vw
          const scaleY = rect.height / vh

          const box = detection.detection.box
          const faceCX = box.x + box.width / 2
          const faceCY = box.y + box.height / 2

          const mirroredCX = vw - faceCX
          const containerCX = mirroredCX * scaleX
          const containerCY = faceCY * scaleY

          const ovalCX = rect.width / 2
          const ovalCY = rect.height / 2
          const normDx = (containerCX - ovalCX) / (OVAL_W / 2)
          const normDy = (containerCY - ovalCY) / (OVAL_H / 2)
          const dist = Math.sqrt(normDx * normDx + normDy * normDy)
          const centered = dist <= CENTER_THRESHOLD

          if (centered) {
            setFaceStatus("centered")
            setDirectionHint(null)
            setShowArrow(null)

            if (centeredStart === null) centeredStart = Date.now()
            else if (Date.now() - centeredStart >= CAPTURE_DELAY_MS) {
              centeredStart = null
              setCenteredProgress(0)
              await capture()
              return
            }
          } else {
            centeredStart = null
            setFaceStatus("off-center")

            if (Math.abs(normDx) > Math.abs(normDy)) {
              const dir = normDx > 0 ? "right" : "left"
              setShowArrow(dir)
              setDirectionHint(DIRECTION_ARROWS[dir].label)
            } else {
              const dir = normDy > 0 ? "down" : "up"
              setShowArrow(dir)
              setDirectionHint(DIRECTION_ARROWS[dir].label)
            }
          }
        } else {
          setFaceStatus("no-face")
          setDirectionHint(null)
          setShowArrow(null)
          centeredStart = null
        }
        setDetecting(false)
      } catch {
        centeredStart = null
      }

      if (!cancelled) {
        loopTimer = setTimeout(() => loop(), 200)
      }
    }

    loopTimer = setTimeout(() => loop(), 800)

    return () => {
      cancelled = true
      if (loopTimer !== null) clearTimeout(loopTimer)
      clearInterval(interval)
    }
  }, [modelsLoaded, done, capture, step])

  const handleComplete = async () => {
    if (descriptorsRef.current.length < 5) return
    setCompleting(true)
    setFaceError(null)
    try {
      await onComplete(descriptorsRef.current, imagesRef.current)
    } catch (err: any) {
      setFaceError(err?.message || "Erro ao salvar cadastro facial. Tente novamente.")
    } finally {
      setCompleting(false)
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-default/20 rounded-xl p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#C96B6B]/10 flex items-center justify-center mx-auto mb-4">
            <Camera size="24" className="text-[#C96B6B]" />
          </div>
          <h3 className="text-base font-bold text-primary mb-2">Erro na Câmera</h3>
          <p className="text-sm text-secondary mb-5">{error}</p>
          {onSkip && (
            <button onClick={onSkip} className="h-11 px-6 rounded-lg bg-surface border border-default/30 text-sm font-medium text-secondary hover:text-primary transition-all duration-200">
              Pular cadastro facial
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loadingModels) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-default/20 rounded-xl p-8 text-center">
          <Loader2 size="32" className="animate-spin text-[var(--accent-primary)] mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-primary">Preparando reconhecimento facial...</h3>
          <p className="text-xs text-secondary mt-1">Carregando modelos de detecção</p>
        </div>
      </div>
    )
  }

  if (done && descriptorsRef.current.length >= 5) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-default/20 rounded-xl p-8 text-center animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-[#5B9B7A]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size="32" className="text-[#5B9B7A]" />
          </div>
          <h3 className="text-base font-bold text-primary mb-1">Cadastro facial concluído com sucesso</h3>
          <p className="text-xs text-secondary mb-2">Sua biometria facial foi registrada com segurança</p>
          {faceError && (
            <p className="text-xs text-[#D94A4A] mb-4">{faceError}</p>
          )}
          <button
            onClick={handleComplete}
            disabled={completing}
            className="h-11 px-8 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white flex items-center gap-2 mx-auto hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all duration-200"
          >
            {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {completing ? "Salvando..." : "Finalizar"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-default/20 rounded-xl overflow-hidden shadow-2xl">
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 z-10 md:w-11 md:h-11 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/5 transition-all duration-200"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <div className="p-5 pb-3">
          <h3 className="text-base font-bold text-primary tracking-tight">Cadastro de Identidade Facial</h3>
          <p className="text-xs text-secondary mt-0.5">Para aumentar a segurança dos registros de ponto, precisamos cadastrar sua biometria facial.</p>
        </div>

        <div ref={containerRef} className="relative mx-5 rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-48 h-56">
              <div className={`absolute inset-0 rounded-full border-2 transition-all duration-200 ${
                faceStatus === "centered"
                  ? "border-[#5B9B7A]/80 shadow-[0_0_20px_rgba(91,155,122,0.25)]"
                  : faceStatus === "off-center"
                  ? "border-[#D94A4A]/80 shadow-[0_0_20px_rgba(217,74,74,0.25)]"
                  : "border-white/30"
              }`} />
              {faceStatus === "centered" && centeredProgress > 0 && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(91,155,122,0.15)" strokeWidth="2" />
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#5B9B7A" strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 46}`}
                    strokeDashoffset={`${2 * Math.PI * 46 * (1 - centeredProgress)}`}
                    strokeLinecap="round"
                    className="transition-all duration-100 ease-linear"
                  />
                </svg>
              )}
            </div>
          </div>

          {faceStatus === "off-center" && showArrow && (() => {
            const ArrowIcon = DIRECTION_ARROWS[showArrow].icon
            const translateCls = showArrow === "left" ? "animate-[bounce-x_1s_ease-in-out_infinite]" :
              showArrow === "right" ? "animate-[bounce-x_1s_ease-in-out_infinite]" :
              showArrow === "up" ? "animate-bounce" :
              "animate-bounce"
            return (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className={`${translateCls}`}>
                    <ArrowIcon size="36" className="text-[#D94A4A] drop-shadow-[0_0_12px_rgba(217,74,74,0.5)]" />
                  </div>
                  <span className="text-xs font-semibold text-white bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg">
                    {directionHint}
                  </span>
                </div>
              </div>
            )
          })()}

          {detecting && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
              <Loader2 size="12" className="animate-spin text-[var(--accent-primary)]" />
              <span className="text-[10px] text-white font-medium">Detectando rosto...</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">
              {CAPTURE_STEPS[step].instruction}
            </span>
            <span className="text-[10px] text-muted font-medium">Captura {step + 1} de {CAPTURE_STEPS.length}</span>
          </div>

          <div className="flex gap-1">
            {CAPTURE_STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  i < step ? "bg-[#5B9B7A]" : i === step ? "bg-[var(--accent-primary)]" : "bg-default/10"
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {CAPTURE_STEPS.map((s, i) => (
              <div key={i} className={`text-center p-1.5 rounded-lg transition-all duration-200 ${
                i === step ? "bg-[var(--accent-primary)]/8 ring-1 ring-[var(--accent-primary)]/30" : i < step ? "bg-[#5B9B7A]/8" : ""
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-0.5 ${
                  i < step ? "bg-[#5B9B7A]/20" : i === step ? "bg-[var(--accent-primary)]/20" : "bg-elevated/30"
                }`}>
                  {i < step ? (
                    <CheckCircle2 size="12" className="text-[#5B9B7A]" />
                  ) : (
                    <span className={`text-[10px] font-bold ${i === step ? "text-[var(--accent-primary)]" : "text-muted"}`}>{i + 1}</span>
                  )}
                </div>
                <span className={`text-[8px] font-medium leading-tight block ${
                  i === step ? "text-[var(--accent-primary)]" : i < step ? "text-[#5B9B7A]" : "text-muted"
                }`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
