export interface TimeRecord {
  id: string
  data: string
  dataISO: string
  entrada: string
  saidaIntervalo: string
  retornoIntervalo: string
  saida: string
  total: string
  totalHours: number
  tipo: "Normal" | "Extra" | "Compensação" | "Afastamento" | "Negativo" | "Pendente"
}

export interface Justificacao {
  motivo: string
  observacao: string
  anexoNome: string
  dataInicio: string
  dataFim: string
  status: "em_analise" | "aprovado" | "recusado"
}

export interface WorkflowNotification {
  id: string
  tipo: "pendencia" | "alerta" | "informativo"
  titulo: string
  mensagem: string
  timestamp: string
  lida: boolean
  status?: "aprovado" | "recusado" | "em_analise"
  acao?: {
    pagina: string
    dataISO?: string
  }
}

export interface BackendNotification {
  id: string
  title: string
  message: string
  type: "SYSTEM" | "APPROVAL" | "WARNING" | "INFO"
  read: boolean
  link: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  userId: string
}

export interface FormData {
  data: string
  entrada: string
  saidaIntervalo?: string
  retornoIntervalo?: string
  saida?: string
  motivo?: string
}

export interface PageAction {
  type: "openExport" | "selectDay"
  payload?: Record<string, string>
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

export function formatMinutes(mins: number): string {
  const totalMin = Math.round(mins)
  const sign = totalMin < 0 ? "-" : ""
  const abs = Math.abs(totalMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m`
}

export function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export type PointType = "ENTRY" | "BREAK_START" | "BREAK_END" | "EXIT"

export interface PointEvent {
  id: string
  pointType: PointType
  timeValue: string
  recordedAt: string
  latitude: number | null
  longitude: number | null
  locationAccuracy: number | null
  locationAddress: string | null
  locationCity: string | null
  locationState: string | null
  deviceInfo: Record<string, unknown> | null
  photoData: string | null
  hasPhoto: boolean
  passwordVerified: boolean
  faceVerified: boolean | null
  date: string
}

export interface DeviceInfo {
  browser: string
  os: string
  userAgent: string
  timezone: string
  language: string
  screenWidth: number
  screenHeight: number
}

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  address: string
  city: string
  state: string
  postcode?: string
}

export interface TermAcceptance {
  id: string
  acceptedAt: string
  ip: string | null
  userAgent: string | null
}

export interface FaceRegistrationData {
  id: string
  status: string
  descriptors: number[][] | null
  images: string[] | null
  createdAt: string
}

export interface PointEventWithFace extends PointEvent {
  faceVerified: boolean | null
}
