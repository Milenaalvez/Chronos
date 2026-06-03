import bcrypt from 'bcryptjs'
import { prisma } from '../../database/prisma.js'
import { AppError } from '../../middleware/error.js'

function parseTimeValue(t: string): number {
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export async function listPointRecords(userId: string, companyId: string, date?: string, includePhoto?: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  })
  if (!user || user.companyId !== companyId) return []

  const where: any = { userId }
  if (date) {
    where.date = new Date(date)
  }
  const selectFields: any = {
    id: true,
    pointType: true,
    timeValue: true,
    recordedAt: true,
    latitude: true,
    longitude: true,
    locationAccuracy: true,
    locationAddress: true,
    locationCity: true,
    locationState: true,
    deviceInfo: true,
    hasPhoto: true,
    passwordVerified: true,
    faceVerified: true,
    date: true,
  }
  if (includePhoto) {
    selectFields.photoData = true
  }
  return prisma.pointEvent.findMany({
    where,
    orderBy: { recordedAt: 'asc' },
    select: selectFields,
  })
}

export async function createPointRecord(userId: string, data: {
  pointType: 'ENTRY' | 'BREAK_START' | 'BREAK_END' | 'EXIT'
  timeValue: string
  latitude?: number | null
  longitude?: number | null
  locationAccuracy?: number | null
  locationAddress?: string | null
  locationCity?: string | null
  locationState?: string | null
  deviceInfo?: Record<string, unknown> | null
  photoData?: string | null
  hasPhoto?: boolean
  password?: string
  faceVerified?: boolean | null
}) {
  // Verify password
  if (!data.password) {
    throw new AppError(400, 'Senha de confirmação é obrigatória')
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })
  if (!user) {
    throw new AppError(404, 'Usuário não encontrado')
  }
  const passwordValid = await bcrypt.compare(data.password, user.password)
  if (!passwordValid) {
    throw new AppError(401, 'Senha inválida')
  }

  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const date = new Date(dateStr)

  const event = await prisma.pointEvent.create({
    data: {
      userId,
      date,
      pointType: data.pointType,
      timeValue: data.timeValue,
      recordedAt: now,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationAccuracy: data.locationAccuracy ?? null,
      locationAddress: data.locationAddress ?? null,
      locationCity: data.locationCity ?? null,
      locationState: data.locationState ?? null,
      deviceInfo: data.deviceInfo ?? null,
      photoData: data.photoData ?? null,
      hasPhoto: data.hasPhoto ?? false,
      passwordVerified: true,
      faceVerified: data.faceVerified ?? null,
    },
  })

  // Link or update the daily TimeRecord
  const existing = await prisma.timeRecord.findUnique({
    where: { userId_date: { userId, date } },
  })

  const updateData: any = {}
  if (data.pointType === 'ENTRY') updateData.clockIn = data.timeValue
  else if (data.pointType === 'BREAK_START') updateData.breakStart = data.timeValue
  else if (data.pointType === 'BREAK_END') updateData.breakEnd = data.timeValue
  else if (data.pointType === 'EXIT') updateData.clockOut = data.timeValue

  if (existing) {
    const merged = { ...updateData }
    // If this is the EXIT, compute totals
    const clockIn = merged.clockIn ?? existing.clockIn
    const breakStart = merged.breakStart ?? existing.breakStart
    const breakEnd = merged.breakEnd ?? existing.breakEnd
    const clockOut = merged.clockOut ?? existing.clockOut

    if (clockOut && clockIn && /^\d/.test(clockIn) && /^\d/.test(clockOut)) {
      const normalize = (t: number, ref: number) => t > ref ? t - 1440 : t
      const ci = normalize(parseTimeValue(clockIn), parseTimeValue(clockOut))
      const bs = breakStart && /^\d/.test(breakStart) ? normalize(parseTimeValue(breakStart), parseTimeValue(clockOut)) : null
      const be = breakEnd && /^\d/.test(breakEnd) ? normalize(parseTimeValue(breakEnd), parseTimeValue(clockOut)) : null
      const co = parseTimeValue(clockOut)
      const morning = bs !== null ? bs - ci : co - ci
      const afternoon = bs !== null && be !== null ? co - be : 0
      const totalRaw = morning + afternoon
      const totalMins = Number.isFinite(totalRaw) ? Math.max(Math.round(totalRaw), 0) : 0
      const overtimeMins = totalMins > 480 ? totalMins - 480 : 0

      let status = 'NORMAL'
      if (totalMins <= 0) status = 'ABSENCE'
      else if (overtimeMins > 0) status = 'OVERTIME'
      else if (totalMins < 240) status = 'ABSENCE'

      merged.totalMinutes = totalMins
      merged.overtimeMinutes = overtimeMins
      merged.status = status
      merged.reviewStatus = 'PENDING_REVIEW'
      merged.reviewedBy = null
      merged.reviewedAt = null
      merged.reviewNote = null
    }

    await prisma.timeRecord.update({
      where: { id: existing.id },
      data: { ...merged, pointEvents: { connect: { id: event.id } } },
    })
  } else {
    const createData: any = {
      userId,
      date,
      clockIn: data.pointType === 'ENTRY' ? data.timeValue : '--:--',
      status: 'NORMAL',
      reviewStatus: 'PENDING_REVIEW',
      pointEvents: { connect: { id: event.id } },
    }
    if (data.pointType === 'BREAK_START') createData.breakStart = data.timeValue
    if (data.pointType === 'BREAK_END') createData.breakEnd = data.timeValue
    if (data.pointType === 'EXIT') createData.clockOut = data.timeValue

    await prisma.timeRecord.create({ data: createData })
  }

  prisma.activityLog.create({
    data: {
      userId,
      action: 'TIMERECORD_CREATE',
      description: `Registro de ${data.pointType === 'ENTRY' ? 'entrada' : data.pointType === 'BREAK_START' ? 'saída para intervalo' : data.pointType === 'BREAK_END' ? 'retorno do intervalo' : 'saída'} às ${data.timeValue}`,
      entityType: 'PointEvent',
      entityId: event.id,
      targetUserId: userId,
      metadata: { pointType: data.pointType, timeValue: data.timeValue, latitude: data.latitude, longitude: data.longitude },
    },
  }).catch(() => {})

  return event
}
