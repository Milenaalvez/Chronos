import { prisma } from '../../database/prisma.js'
import { createNotification, deleteNotificationByMetadata } from '../notification/notification.service.js'
import type { RecordStatus } from '../../../src/generated/prisma/enums.js'
import { getEffectivePermissions } from '../../utils/permissions.js'

export async function listRecords(userId: string, startDate?: string, endDate?: string) {
  const where: any = { userId }
  if (startDate || endDate) {
    where.date = {}
    if (startDate) where.date.gte = new Date(startDate)
    if (endDate) where.date.lte = new Date(endDate)
  }
  const records = await prisma.timeRecord.findMany({
    where,
    orderBy: { date: 'desc' },
  })
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  for (const r of records) {
    if (!r.clockOut && r.clockIn) {
      const recordDate = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).substring(0, 10)
      if (recordDate === todayStr) {
        const ci = parseTimePart(r.clockIn)
        const bs = r.breakStart ? parseTimePart(r.breakStart) : null
        const be = r.breakEnd ? parseTimePart(r.breakEnd) : null
        const now = today.getHours() * 60 + today.getMinutes()
        if (ci !== null) {
          const norm = (t: number) => t > now ? t - 1440 : t
          const nci = norm(ci)
          const nbs = bs !== null ? norm(bs) : null
          const nbe = be !== null ? norm(be) : null
          let worked = now - nci
          if (nbs !== null && nbe !== null) worked -= (nbe - nbs)
          else if (nbs !== null && nbe === null) worked = nbs - nci
          Object.assign(r, { totalMinutes: Math.max(Math.round(worked), 0) })
        }
      }
    }
  }
  return records
}

function parseTimePart(t: string): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export async function getRecord(id: string, userId: string) {
  const record = await prisma.timeRecord.findUnique({ where: { id } })
  if (!record || record.userId !== userId) return null
  return record
}

export async function upsertRecord(userId: string, data: {
  date: string
  clockIn: string
  clockOut?: string
  breakStart?: string
  breakEnd?: string
  description?: string
  status?: RecordStatus
}) {
  const date = new Date(data.date)
  const dayOfWeek = date.getDay()

  // Block registration on weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw Object.assign(new Error('Não é permitido registrar ponto aos sábados e domingos.'), { statusCode: 400 })
  }

  if (data.clockOut) {
    // Full record with clock-out
    const clockIn = new Date(`${data.date}T${data.clockIn}:00`)
    const clockOut = new Date(`${data.date}T${data.clockOut}:00`)
    const breakStart = data.breakStart ? new Date(`${data.date}T${data.breakStart}:00`) : null
    const breakEnd = data.breakEnd ? new Date(`${data.date}T${data.breakEnd}:00`) : null

    const hasBreak = breakStart && breakEnd
    const totalMinutes = hasBreak
      ? Math.round(((breakStart.getTime() - clockIn.getTime()) + (clockOut.getTime() - breakEnd.getTime())) / 60000)
      : Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
    const clamped = Math.max(totalMinutes, 0)
    const overtimeMinutes = clamped > 480 ? clamped - 480 : 0

    let status = data.status || 'NORMAL' as RecordStatus
    if (totalMinutes < 0) status = 'ABSENCE' as RecordStatus
    else if (overtimeMinutes > 0) status = 'OVERTIME' as RecordStatus
    else if (clamped < 240) status = 'ABSENCE' as RecordStatus

    // Auto-resolve "missing clock-in" notification
    deleteNotificationByMetadata(userId, { type: 'missing_clockin' }).catch(() => {})

    const reviewStatus = 'PENDING_REVIEW' as const

    const result = await prisma.timeRecord.upsert({
      where: { userId_date: { userId, date } },
      update: {
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        breakStart: data.breakStart || null,
        breakEnd: data.breakEnd || null,
        totalMinutes: clamped,
        overtimeMinutes,
        reviewStatus,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      },
      create: {
        userId,
        date,
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        breakStart: data.breakStart || null,
        breakEnd: data.breakEnd || null,
        totalMinutes: clamped,
        overtimeMinutes,
        description: data.description,
        status,
        reviewStatus,
      },
    })

    // Notify admins about pending review
    const userWithCompany = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, name: true },
    })
    if (userWithCompany) {
      const admins = await prisma.user.findMany({
        where: {
          companyId: userWithCompany.companyId,
          isActive: true,
          role: { in: ['ADMIN', 'RH', 'DEVELOPER'] },
        },
        select: { id: true, role: true, permissions: true },
      })
      const approvers = admins.filter((a) => {
        const perms = getEffectivePermissions(a.role, a.permissions as string[] | null)
        return perms.includes('approve_time_records') && a.id !== userId
      })
      for (const admin of approvers) {
        createNotification(admin.id, {
          title: 'Registro pendente de análise',
          message: `${userWithCompany.name} registrou ponto no dia ${data.date} aguardando aprovação.`,
          type: 'APPROVAL',
          link: '/equipe',
          metadata: { type: 'time_review', userId, date: data.date, recordId: result.id },
        }).catch(() => {})
      }
    }

    // Notify user about successful registration
    const recordDate = new Date(data.date)
    const hoje = new Date()
    const isToday = recordDate.toISOString().split('T')[0] === hoje.toISOString().split('T')[0]
    const dateLabel = recordDate.toLocaleDateString('pt-BR')

    prisma.activityLog.create({
      data: {
        userId,
        action: result.clockOut ? 'TIMERECORD_CLOCK_OUT' : 'TIMERECORD_CLOCK_IN',
        description: result.clockOut
          ? `Jornada registrada: ${data.clockIn} → ${data.clockOut}`
          : `Entrada registrada às ${data.clockIn}`,
        entityType: 'TimeRecord',
        entityId: result.id,
        targetUserId: userId,
        metadata: { date: data.date, clockIn: data.clockIn, clockOut: data.clockOut, breakStart: data.breakStart, breakEnd: data.breakEnd, totalMinutes: clamped },
      },
    }).catch(() => {})

    createNotification(userId, {
      title: isToday ? 'Jornada enviada para análise' : 'Registro enviado para análise',
      message: isToday
        ? 'Seu ponto de hoje foi registrado e enviado para aprovação.'
        : `Seu ponto do dia ${dateLabel} foi registrado e enviado para aprovação.`,
      type: 'INFO',
      link: '/calendario',
      metadata: { type: 'record_created', date: data.date },
    }).catch(() => {})

    return result
  }

  // Partial record: only clock-in, no clock-out yet
  deleteNotificationByMetadata(userId, { type: 'missing_clockin' }).catch(() => {})

  const existing = await prisma.timeRecord.findUnique({
    where: { userId_date: { userId, date } },
  })

  if (existing && existing.clockOut) {
    // Already has clock-out, just update clock-in
    return prisma.timeRecord.update({
      where: { id: existing.id },
      data: { clockIn: data.clockIn },
    })
  }

  if (existing) {
    // Update existing partial record with new clock-in time
    return prisma.timeRecord.update({
      where: { id: existing.id },
      data: { clockIn: data.clockIn },
    })
  }

  // Create new partial record
  const result = await prisma.timeRecord.create({
    data: {
      userId,
      date,
      clockIn: data.clockIn,
      description: data.description || null,
      status: (data.status || 'NORMAL') as RecordStatus,
      reviewStatus: 'PENDING_REVIEW',
    },
  })

  prisma.activityLog.create({
    data: {
      userId,
      action: 'TIMERECORD_CLOCK_IN',
      description: `Entrada registrada às ${data.clockIn}`,
      entityType: 'TimeRecord',
      entityId: result.id,
      targetUserId: userId,
    },
  }).catch(() => {})

  createNotification(userId, {
    title: 'Entrada registrada',
    message: `Sua entrada às ${data.clockIn} foi registrada. Não esqueça de registrar a saída no final do expediente.`,
    type: 'INFO',
    metadata: { type: 'clockin_only', date: data.date },
  }).catch(() => {})

  return result
}

export async function deleteRecord(id: string, userId: string) {
  const record = await prisma.timeRecord.findUnique({ where: { id } })
  if (!record || record.userId !== userId) return false
  await prisma.timeRecord.delete({ where: { id } })
  return true
}

export async function approveRecord(id: string, reviewerId: string, companyId: string, note?: string) {
  const record = await prisma.timeRecord.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, companyId: true } } },
  })
  if (!record || record.user.companyId !== companyId) return null

  const updated = await prisma.timeRecord.update({
    where: { id },
    data: {
      reviewStatus: 'APPROVED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  })

  prisma.notification.create({
    data: {
      userId: record.userId,
      title: 'Registro aprovado',
      message: `Seu registro de ${record.date.toISOString().split('T')[0]} foi aprovado.`,
      type: 'APPROVAL',
      link: '/calendario',
      metadata: { type: 'time_approved', recordId: id, date: record.date.toISOString().split('T')[0] },
    },
  }).catch(() => {})

  prisma.activityLog.create({
    data: {
      userId: reviewerId,
      action: 'APPROVE_TIME_RECORD',
      description: `Aprovou registro de ${record.user.name} em ${record.date.toISOString().split('T')[0]}`,
      entityType: 'TimeRecord',
      entityId: id,
      targetUserId: record.userId,
      oldValue: `Entrada: ${record.clockIn}, Saída: ${record.clockOut}`,
      newValue: 'Aprovado',
      metadata: { note, reviewStatus: 'APPROVED' },
    },
  }).catch(() => {})

  return updated
}

export async function rejectRecord(id: string, reviewerId: string, companyId: string, note?: string) {
  const record = await prisma.timeRecord.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, companyId: true } } },
  })
  if (!record || record.user.companyId !== companyId) return null

  const updated = await prisma.timeRecord.update({
    where: { id },
    data: {
      reviewStatus: 'REJECTED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  })

  prisma.notification.create({
    data: {
      userId: record.userId,
      title: 'Registro recusado',
      message: note
        ? `Seu registro de ${record.date.toISOString().split('T')[0]} foi recusado: ${note}`
        : `Seu registro de ${record.date.toISOString().split('T')[0]} foi recusado.`,
      type: 'WARNING',
      link: '/calendario',
      metadata: { type: 'time_rejected', recordId: id, date: record.date.toISOString().split('T')[0] },
    },
  }).catch(() => {})

  prisma.activityLog.create({
    data: {
      userId: reviewerId,
      action: 'REJECT_TIME_RECORD',
      description: `Recusou registro de ${record.user.name} em ${record.date.toISOString().split('T')[0]}`,
      entityType: 'TimeRecord',
      entityId: id,
      targetUserId: record.userId,
      oldValue: `Entrada: ${record.clockIn}, Saída: ${record.clockOut}`,
      newValue: `Recusado: ${note || 'Sem motivo'}`,
      metadata: { note, reviewStatus: 'REJECTED' },
    },
  }).catch(() => {})

  return updated
}

export async function listPendingReviews(companyId: string) {
  return prisma.timeRecord.findMany({
    where: {
      reviewStatus: 'PENDING_REVIEW',
      user: { companyId, isActive: true },
    },
    orderBy: { date: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, role: true, department: true, position: true } },
    },
  })
}
