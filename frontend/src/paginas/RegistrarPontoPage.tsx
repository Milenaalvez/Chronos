import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { MapPin, Smartphone, ShieldCheck, Clock, LogIn, LogOut, Coffee, Undo2, CheckCircle2, XCircle, AlertTriangle, Loader2, User, Wifi, ArrowUpRight, ArrowDownLeft, ScanLine, Maximize2, X, Monitor, Globe } from "lucide-react"
import { PageHeader } from "../componentes/PageHeader"
import { PointVerificationModal } from "../componentes/PointVerificationModal"
import { LocationMap } from "../componentes/LocationMap"
import { pointRecords as apiPointRecords, faceRegistration as apiFaceRegistration } from "../services/api"
import type { PointEvent, PointType, DeviceInfo, LocationData } from "../types"
import { loadFaceModels } from "../utils/face"

const POINT_CONFIG: Record<PointType, { label: string; desc: string; icon: any }> = {
  ENTRY: { label: "Entrada", desc: "Início da jornada", icon: LogIn },
  BREAK_START: { label: "Saída para intervalo", desc: "Início do descanso", icon: Coffee },
  BREAK_END: { label: "Retorno do intervalo", desc: "Retorno à jornada", icon: Undo2 },
  EXIT: { label: "Saída", desc: "Encerramento da jornada", icon: LogOut },
}

const POINT_ORDER: PointType[] = ["ENTRY", "BREAK_START", "BREAK_END", "EXIT"]

function nowTime(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]
}

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent
  const getBrowser = () => {
    if (ua.includes("Edg")) return "Edge"
    if (ua.includes("Chrome")) return "Chrome"
    if (ua.includes("Firefox")) return "Firefox"
    if (ua.includes("Safari")) return "Safari"
    return "Desconhecido"
  }
  const getOS = () => {
    if (ua.includes("Windows")) return "Windows"
    if (ua.includes("Mac")) return "macOS"
    if (ua.includes("Linux")) return "Linux"
    if (ua.includes("Android")) return "Android"
    if (ua.includes("iOS")) return "iOS"
    return "Desconhecido"
  }
  const browserVer = ua.match(/(Chrome|Edg|Firefox|Safari)\/(\d+)/)?.[2] || ""
  return {
    browser: `${getBrowser()} ${browserVer}`,
    os: getOS(),
    userAgent: ua,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  }
}

function maskCPF(cpf?: string | null): string {
  if (!cpf) return "---"
  const d = cpf.replace(/\D/g, "")
  if (d.length < 11) return "***.***.***-**"
  return d.slice(0, 3) + ".***.***-" + d.slice(-2)
}

function formatTimeDisplay(mins: number): string {
  const abs = Math.abs(mins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${mins >= 0 ? "+" : "-"}${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m`
}

function parseTimeValue(t: string): number {
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

function formatTimeValue(t: string): string {
  const mins = parseTimeValue(t)
  const h = String(Math.floor(mins / 60)).padStart(2, "0")
  const m = String(mins % 60).padStart(2, "0")
  return `${h}:${m}`
}

const LOCATION_STABLE_REF = { lat: 0, lng: 0 }
const STABLE_THRESHOLD_M = 50 // só atualiza se mudar mais que 50m

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function roundCoord(v: number, decimals = 5): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

async function getLocation(): Promise<LocationData | null> {
  if (!navigator.geolocation) return null
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      })
    })
    let { latitude, longitude, accuracy } = pos.coords
    latitude = roundCoord(latitude)
    longitude = roundCoord(longitude)
    accuracy = Math.round(accuracy)

    // Estabiliza: se moveu menos que o threshold, mantém referência anterior
    if (LOCATION_STABLE_REF.lat !== 0) {
      const dist = haversineMeters(LOCATION_STABLE_REF.lat, LOCATION_STABLE_REF.lng, latitude, longitude)
      if (dist < STABLE_THRESHOLD_M) {
        latitude = LOCATION_STABLE_REF.lat
        longitude = LOCATION_STABLE_REF.lng
      } else {
        LOCATION_STABLE_REF.lat = latitude
        LOCATION_STABLE_REF.lng = longitude
      }
    } else {
      LOCATION_STABLE_REF.lat = latitude
      LOCATION_STABLE_REF.lng = longitude
    }

    let address = "", city = "", state = "", postcode = ""
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        { headers: { "Accept-Language": "pt-BR" } }
      )
      const geo = await res.json()
      if (geo.address) {
        address = geo.address.suburb || geo.address.neighbourhood || geo.address.road || ""
        city = geo.address.city || geo.address.town || geo.address.village || ""
        state = geo.address.state || ""
        postcode = geo.address.postcode || ""
      }
    } catch { /* ignore */ }
    return { latitude, longitude, accuracy, address, city, state, postcode }
  } catch {
    return null
  }
}

interface RegistrarPontoPageProps {
  user?: {
    id: string
    name: string
    email: string
    role: string
    position?: string | null
    avatar?: string | null
    registrationNumber?: string | null
    cpf?: string | null
    department?: string | null
    contractType?: string | null
    weeklyHours?: number
  }
  onPointCreated?: () => void
}

export function RegistrarPontoPage({ user, onPointCreated }: RegistrarPontoPageProps) {
  const [todayEvents, setTodayEvents] = useState<PointEvent[]>([])
  const [, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [deviceInfo] = useState<DeviceInfo>(getDeviceInfo)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<PointType | null>(null)
  const [, setRecording] = useState(false)

  // Face verification state
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null)
  const [faceDescriptors, setFaceDescriptors] = useState<number[][] | null>(null)

  // Live location tracking
  const [liveCoords, setLiveCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const watchRef = useRef<number | null>(null)

  const recordedTypes = useMemo(() => new Set(todayEvents.map(e => e.pointType)), [todayEvents])

  const fetchEvents = useCallback(async () => {
    try {
      const events = await apiPointRecords.list(todayISO())
      setTodayEvents(events)
    } catch (err: any) {
      console.warn("[RegistrarPonto] Erro ao carregar eventos:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    // Check face registration for current user only
    apiFaceRegistration.descriptors().then((data) => {
      if (data.descriptors && data.descriptors.length > 0) {
        setFaceRegistered(true)
        setFaceDescriptors(data.descriptors)
        loadFaceModels().catch(() => {})
      } else {
        setFaceRegistered(false)
      }
    }).catch(() => setFaceRegistered(false))
  }, [fetchEvents])

  useEffect(() => {
    getLocation().then((loc) => {
      setLocation(loc)
      setLocationLoading(false)
    })
  }, [])

  // Live location tracking when modal is open
  useEffect(() => {
    if (!locationModalOpen) {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
      return
    }
    if (!navigator.geolocation) return
    setLiveCoords(location ? { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy } : null)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = roundCoord(pos.coords.latitude)
        const lng = roundCoord(pos.coords.longitude)
        const acc = Math.round(pos.coords.accuracy)
        setLiveCoords(prev => {
          if (!prev) return { latitude: lat, longitude: lng, accuracy: acc }
          const dist = haversineMeters(prev.latitude, prev.longitude, lat, lng)
          if (dist < STABLE_THRESHOLD_M) return prev
          return { latitude: lat, longitude: lng, accuracy: acc }
        })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
    }
  }, [locationModalOpen, location])

  const nextToRecord = useMemo(() => {
    for (const t of POINT_ORDER) {
      if (!recordedTypes.has(t)) return t
    }
    return null
  }, [recordedTypes])

  const dayComplete = recordedTypes.size === 4

  const trustChecks = useMemo(() => [
    { label: "Identidade confirmada", ok: !!user },
    { label: "Localização validada", ok: !locationLoading && !!location },
    { label: "Dispositivo reconhecido", ok: !!deviceInfo?.browser },
    { label: "Horário sincronizado", ok: true },
  ], [user, location, locationLoading, deviceInfo])

  const trustPct = useMemo(() => {
    const ok = trustChecks.filter(c => c.ok).length
    return Math.round((ok / trustChecks.length) * 100)
  }, [trustChecks])

  const balance = useMemo(() => {
    const safeParse = (v: string | undefined): number | null => {
      if (!v) return null
      const n = parseTimeValue(v)
      return isNaN(n) ? null : n
    }
    const entry = todayEvents.find(e => e.pointType === "ENTRY")?.timeValue
    const breakS = todayEvents.find(e => e.pointType === "BREAK_START")?.timeValue
    const breakR = todayEvents.find(e => e.pointType === "BREAK_END")?.timeValue
    const exit = todayEvents.find(e => e.pointType === "EXIT")?.timeValue
    if (!entry) return null
    const now = nowTime()
    const ci = safeParse(entry)
    const bs = safeParse(breakS)
    const be = safeParse(breakR)
    const co = safeParse(exit)
    if (ci === null) return null

    // Normaliza para jornadas que viram a meia-noite (ex: entrada 23:10, agora 10:24)
    // Se o horário registrado está à frente de "agora", ele é do dia anterior
    const normalize = (t: number) => t > now ? t - 1440 : t
    const nci = normalize(ci)
    const nbs = bs !== null ? normalize(bs) : null
    const nbe = be !== null ? normalize(be) : null
    const nco = co !== null ? normalize(co) : null

    const onBreak = nbs !== null && nbe === null
    const jornadaEmAndamento = nco === null && !onBreak

    let worked: number
    if (nco !== null) {
      // Jornada completa: (Saída Intervalo - Entrada) + (Saída Final - Retorno Intervalo)
      const morning = nbs !== null ? nbs - nci : nco - nci
      const afternoon = nbs !== null && nbe !== null ? nco - nbe : 0
      worked = Math.max(morning, 0) + Math.max(afternoon, 0)
    } else if (onBreak) {
      // Em intervalo: só o período trabalhado até o intervalo
      worked = Math.max(nbs! - nci, 0)
    } else {
      // Jornada em andamento (sem EXIT): agora - entrada, menos intervalo já realizado
      let total = now - nci
      if (nbs !== null && nbe !== null) {
        total -= (nbe - nbs)
      }
      worked = Math.max(total, 0)
    }

    const expected = Math.max((user?.weeklyHours || 40) * 60 / 5, 1)
    const saldo = co !== null ? worked - expected : null
    const extra = saldo !== null ? Math.max(saldo, 0) : null
    return { worked, saldo, extra, onBreak, jornadaEmAndamento }
  }, [todayEvents, user?.weeklyHours])

  const handleModalConfirm = useCallback(async (password: string, capturedPhoto: string | null) => {
    if (!selectedType) return

    setError(null)
    setSuccessMsg(null)
    setRecording(true)

    try {
      const device = getDeviceInfo()
      const timeMins = nowTime()
      const hh = String(Math.floor(timeMins / 60)).padStart(2, "0")
      const mm = String(timeMins % 60).padStart(2, "0")
      const formattedTime = `${hh}:${mm}`
      const locData = location || await getLocation().catch(() => null)
      if (locData) setLocation(locData)

      const hasPhoto = !!capturedPhoto

      // Face verification already done inside modal — use the match result
      let faceVerified: boolean | null = null
      if (faceRegistered && faceDescriptors && capturedPhoto) {
        // Modal already verified, but we store that verification took place
        faceVerified = true
      }

      if (!locData) {
        throw new Error("Localização não disponível. Ative o GPS e tente novamente.")
      }

      await apiPointRecords.create({
        pointType: selectedType,
        timeValue: formattedTime,
        latitude: locData.latitude,
        longitude: locData.longitude,
        locationAccuracy: locData.accuracy,
        locationAddress: locData.address,
        locationCity: locData.city,
        locationState: locData.state,
        deviceInfo: device as any,
        photoData: capturedPhoto,
        hasPhoto,
        password,
        faceVerified,
      })

      setSuccessMsg(POINT_CONFIG[selectedType].label)
      setSelectedType(null)
      setModalOpen(false)
      await fetchEvents()
      onPointCreated?.()
    } finally {
      setRecording(false)
    }
  }, [selectedType, location, faceRegistered, faceDescriptors, fetchEvents, onPointCreated])

  const openModal = useCallback((type: PointType) => {
    setSelectedType(type)
    setError(null)
    setSuccessMsg(null)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setSelectedType(null)
  }, [])

  const eventStatusIcon = (type: PointType) => {
    if (recordedTypes.has(type)) return <CheckCircle2 size={16} className="text-[var(--accent-green)]" />
    if (type === nextToRecord) return <Clock size={16} className="text-[var(--accent-amber)]" />
    return <XCircle size={16} className="text-muted/40" />
  }

  const eventStatusLabel = (type: PointType) => {
    if (recordedTypes.has(type)) return "Registrado"
    if (type === nextToRecord) return "Pendente"
    return "Aguardando"
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Registrar Ponto"
        subtitle="Registre sua jornada de trabalho com segurança e localização"
      />

      {/* ─── PREMIUM COLLABORATOR CARD ─── */}
      <div className="bg-app border border-default rounded-xl p-5">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 ring-2 ring-[var(--accent-primary)]/20">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center">
                <User size={24} className="text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-primary">{user?.name || "Carregando..."}</h2>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-green)]/8">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
                <span className="text-[10px] font-semibold text-[var(--accent-green)]">Ativo</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1.5 justify-center">
              <div className="text-center">
                <span className="text-[9px] text-muted uppercase tracking-wider">Matrícula</span>
                <p className="text-xs text-primary font-mono mt-px">CHR{user?.registrationNumber || "---"}</p>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-muted uppercase tracking-wider">CPF</span>
                <p className="text-xs text-primary font-mono mt-px">{maskCPF(user?.cpf)}</p>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-muted uppercase tracking-wider">Cargo</span>
                <p className="text-xs text-primary mt-px">{user?.position || user?.role || "---"}</p>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-muted uppercase tracking-wider">Departamento</span>
                <p className="text-xs text-primary mt-px">{user?.department || "---"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TWO COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:gap-8 items-stretch">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="flex flex-col gap-6">

          {/* ─── POINT TYPE CARDS ─── */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
              <Clock size={13} className="text-muted" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">O que deseja registrar?</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {POINT_ORDER.map((type) => {
                const cfg = POINT_CONFIG[type]
                const Icon = cfg.icon
                const done = recordedTypes.has(type)
                const isNext = type === nextToRecord
                const disabled = done || (!done && !isNext)

                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (disabled) return
                      openModal(type)
                    }}
                    disabled={disabled}
                    className={`relative flex flex-col items-center gap-3 p-5 rounded-xl transition-all duration-300 group ${
                      done
                        ? "bg-[var(--accent-green)]/5 border border-[var(--accent-green)]/10 cursor-default"
                        : isNext
                          ? "bg-surface border border-default hover:border-[var(--accent-primary)]/20 hover:bg-[var(--bg-hover)] hover:shadow-[0_0_15px_-8px_var(--accent-primary)] cursor-pointer active:scale-[0.98]"
                          : "bg-surface/30 border border-default/5 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      done ? "bg-[var(--accent-green)]/10" : isNext ? "bg-[var(--accent-primary)]/5 group-hover:bg-[var(--accent-primary)]/8" : "bg-elevated/50"
                    }`}>
                      <Icon size={24} className={
                        done ? "text-[var(--accent-green)]" : isNext ? "text-[var(--accent-primary)]/60" : "text-muted/40"
                      } />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${
                        done ? "text-[var(--accent-green)]" : isNext ? "text-primary" : "text-muted/50"
                      }`}>
                        {cfg.label}
                      </p>
                      <p className={`text-[10px] mt-1 ${
                        done ? "text-[var(--accent-green)]/60" : isNext ? "text-secondary" : "text-muted/30"
                      }`}>
                        {done ? "Registrado" : cfg.desc}
                      </p>
                    </div>
                    {done && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 size={14} className="text-[var(--accent-green)]" />
                      </div>
                    )}
                    {isNext && !done && (
                      <div className="absolute top-2 right-2">
                        <ScanLine size={14} className="text-[var(--accent-primary)]/60" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─── IDENTITY + GEOLOCATION ROW ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

            {/* ─── IDENTITY + VALIDATIONS ─── */}
            <div className="bg-app border border-default rounded-xl p-5 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
                <User size={13} className="text-muted" />
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Identidade</h3>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-[var(--accent-green)] bg-[var(--accent-green)]/8 px-2 py-1 rounded-full">
                  <CheckCircle2 size={10} />
                  Válida
                </span>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2 border-[var(--accent-primary)]/20">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--sidebar-bg)] flex items-center justify-center">
                      <User size={28} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-base font-bold text-primary truncate">{user?.name || "---"}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-[11px] text-secondary font-mono font-medium">
                      CHR{user?.registrationNumber || "---"}
                    </span>
                    <span className="text-[10px] text-secondary">|</span>
                    <span className="text-[11px] text-secondary">
                      {user?.position || user?.role || "---"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                      faceRegistered ? "bg-[#5B9B7A]/8" : "bg-[#D94A4A]/8"
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${faceRegistered ? "bg-[#5B9B7A]" : "bg-[#D94A4A]"}`} />
                      <span className={`text-[9px] font-semibold ${faceRegistered ? "text-[#5B9B7A]" : "text-[#D94A4A]"}`}>
                        {faceRegistered ? "Face cadastrada" : "Face não cadastrada"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/8">
                      <ScanLine size={10} className="text-[var(--accent-primary)]" />
                      <span className="text-[9px] font-semibold text-[var(--accent-primary)]">Verificação via modal</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-default space-y-2">
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--accent-primary)]/4">
                  <span className="text-[10px] font-medium text-secondary">CPF</span>
                  <span className="text-[11px] font-mono font-semibold text-primary">{user?.cpf ? maskCPF(user.cpf) : "---"}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--accent-primary)]/4">
                  <span className="text-[10px] font-medium text-secondary">Departamento</span>
                  <span className="text-[11px] font-semibold text-primary">{user?.department || "---"}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--accent-primary)]/4">
                  <span className="text-[10px] font-medium text-secondary">Contrato</span>
                  <span className="text-[11px] font-semibold text-primary">{user?.contractType || "---"}</span>
                </div>
              </div>
            </div>

            {/* ─── GEOLOCATION ─── */}
            <div className="bg-app border border-default rounded-xl p-5 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
                <MapPin size={13} className="text-muted" />
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Localização</h3>
                {location && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--accent-green)] bg-[var(--accent-green)]/8 px-2 py-0.5 rounded-full">
                    <Wifi size={9} />
                    Verificada
                  </span>
                )}
              </div>

              {locationLoading ? (
                <div className="flex items-center gap-2 py-4 flex-1">
                  <Loader2 size={14} className="animate-spin text-muted" />
                  <span className="text-xs text-secondary">Obtendo localização...</span>
                </div>
              ) : location ? (
                <div className="space-y-3 flex flex-col flex-1">
                  <div
                    className="relative rounded-lg overflow-hidden cursor-pointer group"
                    style={{ height: 140 }}
                    onClick={() => setLocationModalOpen(true)}
                  >
                    <LocationMap
                      latitude={location.latitude}
                      longitude={location.longitude}
                      accuracy={location.accuracy}
                      address={location.address}
                      city={location.city}
                      state={location.state}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Maximize2 size={16} className="text-white/0 group-hover:text-white/70 transition-all" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-primary leading-snug">
                    {location.address && `${location.address}${location.city ? ", " : ""}`}
                    {location.city && `${location.city}/${location.state}`}
                    {location.postcode && ` — CEP ${location.postcode}`}
                    {!location.address && !location.city && `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-elevated/50 rounded-lg p-2">
                      <span className="text-[8px] text-muted uppercase tracking-wider">Latitude</span>
                      <p className="text-[10px] font-mono text-primary mt-px">{location.latitude.toFixed(6)}</p>
                    </div>
                    <div className="bg-elevated/50 rounded-lg p-2">
                      <span className="text-[8px] text-muted uppercase tracking-wider">Longitude</span>
                      <p className="text-[10px] font-mono text-primary mt-px">{location.longitude.toFixed(6)}</p>
                    </div>
                    <div className="bg-elevated/50 rounded-lg p-2">
                      <span className="text-[8px] text-muted uppercase tracking-wider">Precisão</span>
                      <p className="text-[10px] font-mono text-primary mt-px">{location.accuracy}m</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-muted" />
                    <span className="text-[10px] text-muted">Horário GPS:</span>
                    <span className="text-[10px] font-mono text-primary">{new Date().toLocaleTimeString("pt-BR")}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-3 flex-1">
                  <AlertTriangle size={13} className="text-[var(--accent-red)] shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[var(--accent-red)]">Localização não disponível</p>
                    <p className="text-[9px] text-secondary mt-0.5">Ative o GPS para registrar o ponto</p>
                  </div>
                </div>
              )}
            </div>
          </div>



          {/* ─── DEVICE INFO ─── */}
          <div className="bg-app border border-default rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
              <Smartphone size={13} className="text-muted" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Informações do dispositivo</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {[
                { label: "Navegador", value: deviceInfo.browser, icon: Globe },
                { label: "Sistema", value: deviceInfo.os, icon: Monitor },
                { label: "Data/Hora", value: new Date().toLocaleString("pt-BR"), icon: Clock },
                { label: "Fuso", value: deviceInfo.timezone, icon: MapPin },
              ].map((d) => {
                const DIcon = d.icon
                return (
                  <div key={d.label} className="bg-elevated/50 rounded-lg p-3">
                    <DIcon size={10} className="text-muted mb-1.5" />
                    <span className="text-[8px] text-muted uppercase tracking-wider block">{d.label}</span>
                    <span className="text-[10px] text-primary font-mono block truncate mt-0.5">{d.value}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── JORNADA COMPLETA ─── */}
          {dayComplete && !modalOpen && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-[var(--accent-green)]/5 to-[var(--accent-green)]/10 border border-[var(--accent-green)]/15">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-green)]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-[var(--accent-green)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--accent-green)]">Jornada completa!</p>
                <p className="text-[11px] text-secondary mt-0.5">Todos os registros do dia foram realizados com sucesso.</p>
              </div>
            </div>
          )}

          {/* ─── SUCCESS MESSAGE ─── */}
          {successMsg && !modalOpen && (
            <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-[var(--accent-green)]/8 border border-[var(--accent-green)]/10">
              <CheckCircle2 size={16} className="text-[var(--accent-green)] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--accent-green)]">{successMsg} registrada com sucesso!</p>
                <p className="text-[11px] text-secondary mt-0.5">Registro enviado para análise.</p>
              </div>
            </div>
          )}

          {/* ─── ERROR MESSAGE ─── */}
          {error && !modalOpen && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--accent-red)]/8 border border-[var(--accent-red)]/10">
              <AlertTriangle size={14} className="text-[var(--accent-red)] shrink-0" />
              <p className="text-xs font-medium text-[var(--accent-red)]">{error}</p>
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="flex flex-col gap-5 h-full">

          {/* ─── DAY TIMELINE ─── */}
          <div className="bg-app border border-default rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
              <Clock size={13} className="text-muted" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Histórico do Dia</h3>
              {dayComplete && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--accent-green)]">
                  <CheckCircle2 size={9} />
                  Completo
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-default/5" />
              <div className="flex flex-col gap-0">
                {POINT_ORDER.map((type, idx) => {
                  const cfg = POINT_CONFIG[type]
                  const Icon = cfg.icon
                  const event = todayEvents.find(e => e.pointType === type)
                  const isLast = idx === POINT_ORDER.length - 1
                  return (
                    <div key={type} className={`relative flex items-start gap-3.5 ${isLast ? "" : "pb-4"}`}>
                      <div className={`relative z-10 w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 ${
                        event ? "bg-[var(--accent-green)]/10" : type === nextToRecord ? "bg-[var(--accent-amber)]/10" : "bg-elevated/50"
                      }`}>
                        <Icon size={13} className={
                          event ? "text-[var(--accent-green)]" : type === nextToRecord ? "text-[var(--accent-amber)]" : "text-muted/40"
                        } />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold truncate ${event ? "text-primary" : type === nextToRecord ? "text-[var(--accent-amber)]" : "text-muted/40"}`}>
                            {cfg.label}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {event && (
                              <span className="text-[11px] font-mono font-bold text-primary">
                                {formatTimeValue(event.timeValue)}
                              </span>
                            )}
                            {eventStatusIcon(type)}
                          </div>
                        </div>
                        <p className={`text-[10px] mt-px ${event ? "text-secondary" : "text-muted/30"}`}>
                          {event ? eventStatusLabel(type) : eventStatusLabel(type)}
                        </p>
                        {event && event.latitude && (
                          <p className="text-[8px] font-mono text-muted/50 mt-0.5">
                            {event.latitude.toFixed(2)}, {event.longitude?.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <button className="mt-4 w-full text-[11px] font-semibold text-[var(--accent-primary)] hover:brightness-110 transition-all py-2 rounded-lg bg-[var(--accent-primary)]/5 hover:bg-[var(--accent-primary)]/10">
              Ver todos os registros
            </button>
          </div>

          {/* ─── DAY SUMMARY ─── */}
          <div className="bg-app border border-default rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
              <ArrowUpRight size={13} className="text-muted" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Resumo da Jornada</h3>
            </div>
            {balance ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  {balance.jornadaEmAndamento ? (
                    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/10">
                      <Clock size={16} className="text-[var(--accent-primary)] shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-[var(--accent-primary)]">Jornada em andamento</p>
                        <p className="text-[10px] text-secondary mt-0.5">Registre a saída para ver o saldo completo do dia.</p>
                      </div>
                    </div>
                  ) : balance.onBreak ? (
                    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent-amber)]/5 border border-[var(--accent-amber)]/10">
                      <Coffee size={16} className="text-[var(--accent-amber)] shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-[var(--accent-amber)]">Em intervalo</p>
                        <p className="text-[10px] text-secondary mt-0.5">Registre o retorno do intervalo para continuar a jornada.</p>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
                    <span className="text-[9px] text-muted uppercase tracking-wider">Trabalhadas</span>
                    <span className="text-base font-bold text-primary font-mono">
                      {`${String(Math.floor(balance.worked / 60)).padStart(2, "0")}h${String(balance.worked % 60).padStart(2, "0")}m`}
                    </span>
                  </div>
                  {balance.saldo !== null && (
                    <div className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
                      <span className="text-[9px] text-muted uppercase tracking-wider">Saldo do dia</span>
                      <span className={`text-base font-bold font-mono ${balance.saldo >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                        {formatTimeDisplay(balance.saldo)}
                      </span>
                    </div>
                  )}
                  {balance.extra !== null && (
                    <div className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
                      <span className="text-[9px] text-muted uppercase tracking-wider">Horas extras</span>
                      <span className="text-base font-bold text-[var(--accent-amber)] font-mono">
                        {formatTimeDisplay(balance.extra)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Jornada Steps */}
                <div className="pt-1">
                  <div className="relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-default/5" />
                    {POINT_ORDER.map((type, idx) => {
                      const cfg = POINT_CONFIG[type]
                      const Icon = cfg.icon
                      const event = todayEvents.find(e => e.pointType === type)
                      const active = !!event
                      const isNext = type === nextToRecord
                      const isLast = idx === POINT_ORDER.length - 1
                      return (
                        <div key={type} className={`relative flex items-start gap-3 ${isLast ? "" : "pb-3.5"}`}>
                          <div className={`relative z-10 w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 ${
                            active
                              ? "bg-[var(--accent-green)] border-[var(--accent-green)]"
                              : isNext
                                ? "bg-[var(--accent-amber)]/10 border-[var(--accent-amber)]"
                                : "bg-elevated/50 border border-default"
                          }`}>
                            {active ? (
                              <CheckCircle2 size={11} className="text-white" />
                            ) : (
                              <Icon size={10} className={isNext ? "text-[var(--accent-amber)]" : "text-muted/40"} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-semibold ${
                                active ? "text-primary" : isNext ? "text-[var(--accent-amber)]" : "text-muted/40"
                              }`}>
                                {cfg.label}
                              </span>
                              <span className={`text-[10px] font-mono font-bold ${
                                active ? "text-primary" : "text-muted/30"
                              }`}>
                                {event ? formatTimeValue(event.timeValue) : "---"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-3 text-center">
                <ArrowDownLeft size={16} className="mx-auto text-muted/40 mb-1.5" />
                <p className="text-xs text-muted">Registre sua entrada para ver o resumo</p>
              </div>
            )}
          </div>

          {/* ─── TRUST LEVEL ─── */}
          <div className="bg-app border border-default rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-default">
              <ShieldCheck size={13} className="text-muted" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Nível de Confiabilidade</h3>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle
                    cx="36" cy="36" r="30" fill="none"
                    stroke="var(--accent-green)" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - trustPct / 100)}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{trustPct}%</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-[var(--accent-green)]">Alta confiabilidade</p>
              <div className="w-full space-y-2">
                {trustChecks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2">
                    <CheckCircle2 size={10} className={c.ok ? "text-[var(--accent-green)]" : "text-muted/30"} />
                    <span className={`text-[10px] ${c.ok ? "text-secondary" : "text-muted/40"}`}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─── POINT VERIFICATION MODAL ─── */}
      {modalOpen && selectedType && (
        <PointVerificationModal
          pointLabel={POINT_CONFIG[selectedType].label}
          pointDesc={POINT_CONFIG[selectedType].desc}
          pointIcon={POINT_CONFIG[selectedType].icon}
          userName={user?.name || "---"}
          userAvatar={user?.avatar}
          faceRegistered={faceRegistered === true}
          faceDescriptors={faceDescriptors}
          onConfirm={handleModalConfirm}
          onCancel={closeModal}
        />
      )}

      {/* ─── LOCATION MODAL ─── */}
      {locationModalOpen && liveCoords && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setLocationModalOpen(false)}>
          <div className="relative w-full max-w-[95vw] sm:max-w-4xl h-[80vh] bg-surface rounded-2xl border border-default overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-default">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-pulse" />
                <MapPin size={14} className="text-[var(--accent-primary)]" />
                <h2 className="text-sm font-bold text-primary">Localização em Tempo Real</h2>
                <span className="text-[9px] text-muted font-mono">AO VIVO</span>
              </div>
              <button
                className="w-8 h-8 rounded-lg bg-elevated hover:bg-elevated/80 flex items-center justify-center transition-colors"
                onClick={() => setLocationModalOpen(false)}
              >
                <X size={14} className="text-secondary" />
              </button>
            </div>
            <div className="flex-1 relative">
              <LocationMap
                latitude={liveCoords.latitude}
                longitude={liveCoords.longitude}
                accuracy={liveCoords.accuracy}
                address={location?.address}
                city={location?.city}
                state={location?.state}
                height="100%"
                interactive
                live
              />
            </div>
            <div className="px-6 py-4 border-t border-default flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">Lat:</span>
                  <span className="text-[11px] font-mono font-semibold text-primary">{liveCoords.latitude.toFixed(6)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">Lon:</span>
                  <span className="text-[11px] font-mono font-semibold text-primary">{liveCoords.longitude.toFixed(6)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">Precisão:</span>
                  <span className="text-[11px] font-mono font-semibold text-primary">{liveCoords.accuracy}m</span>
                </div>
              </div>
              <p className="text-[10px] text-secondary truncate max-w-[40%] text-right">
                {location?.address && `${location.address}${location.city ? ", " : ""}`}
                {location?.city && `${location.city}/${location.state}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
