import bcrypt from 'bcryptjs'
import { prisma } from '../../database/prisma.js'

export async function listPointRecords(userId: string, date?: string, includePhoto?: boolean) {
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
    throw Object.assign(new Error('Senha de confirmação é obrigatória'), { statusCode: 400 })
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 })
  }
  const passwordValid = await bcrypt.compare(data.password, user.password)
  if (!passwordValid) {
    throw Object.assign(new Error('Senha inválida'), { statusCode: 401 })
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

    if (clockOut && clockIn) {
      const toMins = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      const ci = toMins(clockIn)
      const bs = breakStart ? toMins(breakStart) : null
      const be = breakEnd ? toMins(breakEnd) : null
      const co = toMins(clockOut)
      const morning = bs !== null ? bs - ci : co - ci
      const afternoon = bs !== null && be !== null ? co - be : 0
      const totalMins = Math.max(morning + afternoon, 0)
      const overtimeMins = totalMins > 480 ? totalMins - 480 : 0

      let status = 'NORMAL'
      if (totalMins < 0) status = 'ABSENCE'
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
