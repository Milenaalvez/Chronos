import { useState, useEffect, useRef, useCallback } from "react"
import { KeyRound, Camera, CheckCircle2, XCircle, AlertTriangle, Loader2, ShieldCheck, User, ArrowRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import * as faceapi from "face-api.js"
import { extractDescriptor, compareDescriptors, descriptorLoaded } from "../utils/face"

interface PointVerificationModalProps {
  pointLabel: string
  pointDesc: string
  pointIcon: any
  userName: string
  userAvatar?: string | null
  faceRegistered: boolean
  faceDescriptors: number[][] | null
  onConfirm: (password: string, capturedPhoto: string | null) => Promise<void>
  onCancel: () => void
}

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

const OVAL_W = 192
const OVAL_H = 224
const CENTER_THRESHOLD = 0.5
const CAPTURE_DELAY_MS = 1500

const DIRECTION_ARROWS: Record<string, { icon: typeof ChevronLeft; label: string }> = {
  left: { icon: ChevronLeft, label: "Vire para a esquerda" },
  right: { icon: ChevronRight, label: "Vire para a direita" },
  up: { icon: ChevronUp, label: "Olhe para cima" },
  down: { icon: ChevronDown, label: "Olhe para baixo" },
}

type FaceStatus = "no-face" | "centered" | "off-center"

export function PointVerificationModal({ pointLabel, pointDesc, pointIcon: PointIcon, userName, userAvatar, faceRegistered, faceDescriptors, onConfirm, onCancel }: PointVerificationModalProps) {
  const [step, setStep] = useState<"password" | "face" | "processing" | "result">("password")
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [, setCaptchaChecked] = useState(false)
  const [captchaVerifying, setCaptchaVerifying] = useState(false)
  const [captchaVerified, setCaptchaVerified] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [, setCameraError] = useState<string | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [, setLoadingModels] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("no-face")
  const [directionHint, setDirectionHint] = useState<string | null>(null)
  const [showArrow, setShowArrow] = useState<"left" | "right" | "up" | "down" | null>(null)
  const [centeredProgress, setCenteredProgress] = useState(0)
  const capturingRef = useRef(false)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [faceMatch, setFaceMatch] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Load face models
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (descriptorLoaded()) {
        if (!cancelled) setModelsLoaded(true)
        setLoadingModels(false)
        return
      }
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        if (!cancelled) setModelsLoaded(true)
      } catch {
        if (!cancelled) setError("Erro ao carregar modelo facial")
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Start camera when entering face step
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraReady(true)
    } catch {
      setCameraError("Câmera não disponível. Permita o acesso e tente novamente.")
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Handle captcha toggle
  const handleCaptchaToggle = useCallback(() => {
    if (captchaVerified) return
    setCaptchaVerifying(true)
    setTimeout(() => {
      setCaptchaChecked(true)
      setCaptchaVerified(true)
      setCaptchaVerifying(false)
    }, 600)
  }, [captchaVerified])

  // Go to face step (or skip if no face registered)
  const handleGoToFace = useCallback(async () => {
    if (!password) {
      setPasswordError("Digite sua senha para continuar.")
      return
    }
    if (!captchaVerified) {
      setError("Marque a verificação anti-robô.")
      return
    }
    setError(null)
    setPasswordError(null)
    if (!faceDescriptors || faceDescriptors.length === 0) {
      setFaceMatch(true)
      setStep("result")
      return
    }
    setStep("face")
    await startCamera()
  }, [password, captchaVerified, startCamera, faceDescriptors])

  // Detection loop for face centering
  useEffect(() => {
    if (step !== "face" || !modelsLoaded || !cameraReady) return

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
      if (cancelled || capturingRef.current) return

      const vid = videoRef.current
      if (!vid || !vid.videoWidth) {
        if (!cancelled) loopTimer = setTimeout(() => loop(), 500)
        return
      }

      try {
        setDetecting(true)
        const detection = await faceapi.detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks()

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
              await captureAndVerify()
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
  }, [step, modelsLoaded, cameraReady])

  const captureAndVerify = useCallback(async () => {
    if (capturingRef.current) return
    capturingRef.current = true
    setStep("processing")

    const vid = videoRef.current
    if (!vid || !vid.videoWidth) {
      capturingRef.current = false
      setStep("face")
      setError("Erro ao acessar câmera")
      return
    }

    try {
      // Capture frame
      const canvas = document.createElement("canvas")
      canvas.width = vid.videoWidth
      canvas.height = vid.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) { capturingRef.current = false; setStep("face"); return }
      ctx.drawImage(vid, 0, 0)
      const imgData = canvas.toDataURL("image/jpeg", 0.8)
      setCapturedPhoto(imgData)

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      // Extract descriptor and compare
      const img = new Image()
      img.src = imgData
      await img.decode()
      const descriptor = await extractDescriptor(img)

      if (!descriptor) {
        setFaceMatch(false)
        setError("Nenhum rosto detectado na imagem. Tente novamente.")
        setStep("result")
        capturingRef.current = false
        return
      }

      if (!faceDescriptors) return
      const matches = faceDescriptors.some((ref) => compareDescriptors(ref, descriptor))
      setFaceMatch(matches)

      if (matches) {
        setError(null)
        setStep("result")
      } else {
        setError("Rosto não reconhecido. Seu rosto não corresponde ao cadastro facial.")
        setStep("result")
      }
    } catch {
      setError("Erro ao processar imagem facial.")
      setStep("result")
    }

    capturingRef.current = false
  }, [faceDescriptors])

  const retryFace = useCallback(() => {
    setFaceMatch(null)
    setError(null)
    setCapturedPhoto(null)
    setStep("face")
    setFaceStatus("no-face")
    setCenteredProgress(0)
    startCamera()
  }, [startCamera])

  const handleConfirm = useCallback(async () => {
    setConfirming(true)
    setConfirmError(null)
    try {
      await onConfirm(password, capturedPhoto || null)
    } catch (err: any) {
      setConfirmError(err?.message || "Erro ao registrar ponto")
    } finally {
      setConfirming(false)
    }
  }, [password, capturedPhoto, onConfirm])

  if (error && step === "result" && faceMatch === false) {
    // Show failure result
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#D94A4A]/10 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-[#D94A4A]" />
            </div>
            <h3 className="text-base font-bold text-primary mb-2">Identidade não confirmada</h3>
            <p className="text-sm text-secondary mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={retryFace} className="h-11 px-6 rounded-lg bg-[var(--accent-primary)] text-sm font-semibold text-white hover:brightness-110 transition-all">
                Tentar novamente
              </button>
              <button onClick={onCancel} className="h-11 px-6 rounded-lg bg-surface border border-white/10 text-sm font-medium text-secondary hover:text-primary transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "result" && faceMatch === true) {
    // Show success
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#5B9B7A]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-[#5B9B7A]" />
            </div>
            <h3 className="text-base font-bold text-primary mb-1">Identidade confirmada!</h3>
            <p className="text-sm text-secondary mb-2">Reconhecimento facial validado com sucesso</p>
            {capturedPhoto && (
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4 border-2 border-[#5B9B7A]/30 shadow-[0_0_15px_-3px_#5B9B7A]">
                <img src={capturedPhoto} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {confirmError && (
              <p className="text-xs text-[#D94A4A] mb-4">{confirmError}</p>
            )}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="h-11 px-8 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-sm font-bold text-white flex items-center gap-2 mx-auto hover:brightness-110 disabled:opacity-40 transition-all shadow-[0_0_20px_-5px_#3B82F6]"
            >
              {confirming ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {confirming ? "Registrando..." : `Confirmar ${pointLabel}`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-white/10 rounded-xl p-8 text-center">
          <Loader2 size={32} className="animate-spin text-[var(--accent-primary)] mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-primary">Verificando identidade facial...</h3>
          <p className="text-xs text-secondary mt-1">Comparando com seu cadastro biométrico</p>
        </div>
      </div>
    )
  }

  if (step === "face") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative w-full max-w-lg mx-4 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <button onClick={onCancel} className="absolute top-4 right-4 z-10 md:w-11 md:h-11 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/5 transition-all">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>

          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-[var(--accent-primary)]" />
              <h3 className="text-base font-bold text-primary tracking-tight">Reconhecimento Facial</h3>
            </div>
            <p className="text-xs text-secondary mt-1">Posicione seu rosto no centro do oval para captura automática</p>
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
              return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2">
                    <div className={showArrow === "left" || showArrow === "right" ? "animate-pulse" : "animate-bounce"}>
                      <ArrowIcon size={36} className="text-[#D94A4A] drop-shadow-[0_0_12px_rgba(217,74,74,0.5)]" />
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
                <Loader2 size={12} className="animate-spin text-[var(--accent-primary)]" />
                <span className="text-[10px] text-white font-medium">Detectando rosto...</span>
              </div>
            )}
          </div>

          <div className="p-5 flex items-center justify-between">
            <span className="text-xs text-muted">Alinhe seu rosto ao centro</span>
            <button onClick={onCancel} className="text-[11px] text-muted hover:text-primary transition-colors px-3 py-1.5 rounded-lg bg-white/5">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step: Password + captcha
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <button onClick={onCancel} className="absolute top-4 right-4 z-10 md:w-11 md:h-11 w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-white/5 transition-all">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="p-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <PointIcon size={20} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">{pointLabel}</h3>
              <p className="text-xs text-secondary">{pointDesc}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-5">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
              {userAvatar ? (
                <img src={userAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary truncate">{userName}</p>
              <p className="text-[10px] text-secondary">Titular da conta</p>
            </div>
            {faceRegistered && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#5B9B7A]/8">
                <CheckCircle2 size={9} className="text-[#5B9B7A]" />
                <span className="text-[9px] font-medium text-[#5B9B7A]">Face cadastrada</span>
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={13} className="text-muted" />
              <span className="text-xs font-semibold text-primary">Senha de confirmação</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(null) }}
              placeholder="Digite sua senha"
              autoComplete="off"
              className="w-full h-11 px-4 rounded-xl bg-input border border-input text-[13px] text-primary placeholder:text-muted/50 focus:outline-none focus:border-[var(--accent-primary)]/30 focus:ring-1 focus:ring-[var(--accent-primary)]/15 transition-all"
              onKeyDown={(e) => { if (e.key === "Enter") handleGoToFace() }}
            />
            {passwordError && (
              <p className="text-[11px] text-[#D94A4A] mt-1.5 flex items-center gap-1.5">
                <XCircle size={11} />
                {passwordError}
              </p>
            )}
          </div>

          {/* Captcha */}
          <div>
            <div
              onClick={captchaVerified ? undefined : handleCaptchaToggle}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 cursor-pointer select-none ${
                captchaVerified
                  ? "bg-[#5B9B7A]/8 border-[#5B9B7A]/20"
                  : "bg-white/[0.03] border-white/10 hover:border-white/20"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                captchaVerifying
                  ? "bg-[var(--accent-primary)]/10"
                  : captchaVerified
                    ? "bg-[#5B9B7A]/20"
                    : "bg-white/5"
              }`}>
                {captchaVerifying ? (
                  <Loader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
                ) : captchaVerified ? (
                  <CheckCircle2 size={14} className="text-[#5B9B7A]" />
                ) : (
                  <ShieldCheck size={14} className="text-muted" />
                )}
              </div>
              <div className="flex-1">
                <span className={`text-xs font-semibold ${captchaVerified ? "text-[#5B9B7A]" : "text-primary"}`}>
                  {captchaVerified ? "Verificação concluída" : "Não sou robô"}
                </span>
                {!captchaVerified && (
                  <p className="text-[9px] text-muted mt-px">Clique para confirmar que você não é um robô</p>
                )}
              </div>
              {captchaVerified && (
                <CheckCircle2 size={14} className="text-[#5B9B7A]" />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#D94A4A]/8 border border-[#D94A4A]/10">
              <AlertTriangle size={14} className="text-[#D94A4A] shrink-0" />
              <p className="text-xs font-medium text-[#D94A4A]">{error}</p>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleGoToFace}
            disabled={!password || !captchaVerified}
            className={`w-full h-12 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
              password && captchaVerified
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:brightness-110 active:scale-[0.98] shadow-[0_0_20px_-5px_#3B82F6]"
                : "bg-elevated/10 text-muted/50 cursor-not-allowed border border-white/5"
            }`}
          >
            <span>Continuar</span>
            <ArrowRight size={15} />
          </button>

          {/* Face step indicator */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            <div className={`w-2 h-2 rounded-full ${step === "password" ? "bg-[var(--accent-primary)]" : "bg-[#5B9B7A]"}`} />
            <div className="flex-1 h-px bg-white/10" />
            <div className={`w-2 h-2 rounded-full ${step === "password" ? "bg-white/20" : "bg-white/20"}`} />
            <span className="text-[9px] text-muted ml-1">Etapa 1 de 2</span>
          </div>
        </div>
      </div>
    </div>
  )
}
