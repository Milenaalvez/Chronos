import { prisma } from '../../database/prisma.js'

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, read: false },
  })
}

export async function markAsRead(id: string, userId: string) {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  })
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
}

export async function createNotification(userId: string, data: {
  title: string
  message: string
  type?: 'SYSTEM' | 'APPROVAL' | 'WARNING' | 'INFO'
  link?: string
  metadata?: Record<string, unknown>
}) {
  return prisma.notification.create({
    data: {
      userId,
      title: data.title,
      message: data.message,
      type: data.type || 'INFO',
      link: data.link,
      metadata: data.metadata || undefined,
    },
  })
}

export async function deleteNotification(id: string, userId: string) {
  await prisma.notification.deleteMany({
    where: { id, userId },
  })
}

export async function resolveNotificationsByMetadata(userId: string, metadataFilter: Record<string, string>) {
  const all = await prisma.notification.findMany({
    where: { userId, read: false },
    select: { id: true, metadata: true },
  })

  const matches = all.filter((n) => {
    if (!n.metadata) return false
    const meta = n.metadata as Record<string, unknown>
    return Object.entries(metadataFilter).every(([k, v]) => meta[k] === v)
  })

  if (matches.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: matches.map((n) => n.id) } },
    })
  }
}

export async function deleteNotificationByMetadata(userId: string, metadataFilter: Record<string, string>) {
  const all = await prisma.notification.findMany({
    where: { userId, read: false },
    select: { id: true, metadata: true },
  })

  const matches = all.filter((n) => {
    if (!n.metadata) return false
    const meta = n.metadata as Record<string, unknown>
    return Object.entries(metadataFilter).every(([k, v]) => meta[k] === v)
  })

  if (matches.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: matches.map((n) => n.id) } },
    })
  }
}

// ─── Smart Notification Generators ──────────────────────────────────────────

export async function generateMissingClockInNotifications(userId: string) {
  try {
    const today = new Date()
    const dayOfWeek = today.getDay()

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) return

    today.setHours(0, 0, 0, 0)

    const existing = await prisma.timeRecord.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (existing) {
      // Remove "missing clock-in" notification if record exists
      await deleteNotificationByMetadata(userId, { type: 'missing_clockin' })
      return
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Check if there's a notification created within the last hour
    const existingNotifs = await prisma.notification.findMany({
      where: { userId, read: false },
      select: { id: true, metadata: true, createdAt: true },
    })
    const recentNotif = existingNotifs.find((n) => {
      const meta = n.metadata as Record<string, unknown> | null
      return meta?.type === 'missing_clockin' && n.createdAt > oneHourAgo
    })

    if (recentNotif) return

    // Remove old notifications of this type before creating a new one
    const oldNotifs = existingNotifs.filter((n) => {
      const meta = n.metadata as Record<string, unknown> | null
      return meta?.type === 'missing_clockin'
    })
    if (oldNotifs.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: oldNotifs.map((n) => n.id) } },
      })
    }

    await createNotification(userId, {
      title: 'Jornada de hoje pendente',
      message: 'Você ainda não registrou sua entrada hoje. Não se esqueça de bater o ponto.',
      type: 'WARNING',
      link: '/dashboard',
      metadata: { type: 'missing_clockin', date: today.toISOString().split('T')[0] },
    })
  } catch (err) {
    console.warn(`[Notifications] generateMissingClockInNotifications error for ${userId}:`, (err as Error)?.message)
  }
}

export async function generateMonthlyReportNotification(userId: string, monthLabel: string) {
  const existing = await prisma.notification.findMany({
    where: { userId, read: false },
    select: { metadata: true },
  })
  const alreadyNotified = existing.some((n) => {
    const meta = n.metadata as Record<string, unknown> | null
    return meta?.type === 'monthly_report' && meta?.month === monthLabel
  })

  if (!alreadyNotified) {
    await createNotification(userId, {
      title: 'Relatório mensal disponível',
      message: `Seu relatório de ${monthLabel} já está disponível para consulta.`,
      type: 'INFO',
      link: '/relatorios',
      metadata: { type: 'monthly_report', month: monthLabel },
    })
  }
}

export async function generateOvertimeNotification(userId: string) {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const records = await prisma.timeRecord.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
    })

    const totalMinutes = records.reduce((s, r) => s + (r.totalMinutes || 0), 0)
    const expectedMinutes = 21 * 8 * 60 // ~21 dias úteis x 8h
    const extraMinutes = totalMinutes - expectedMinutes
    const saldoMinutes = records.reduce((s, r) => s + ((r.totalMinutes || 0) - 480), 0)

    const existing = await prisma.notification.findMany({
      where: { userId },
      select: { metadata: true },
    })

    const existingMeta = existing.map((n) => n.metadata as Record<string, unknown> | null)

    // Overtime notification
    if (extraMinutes > 60) {
      const alreadyOvertime = existingMeta.some((m) => m?.type === 'overtime')
      if (!alreadyOvertime) {
        const hours = Math.floor(extraMinutes / 60)
        const mins = extraMinutes % 60
        await createNotification(userId, {
          title: 'Horas extras acumuladas',
          message: `Você possui +${hours}h${mins > 0 ? mins + 'm' : ''} acumuladas este mês.`,
          type: 'INFO',
          metadata: { type: 'overtime', month: `${now.getMonth() + 1}/${now.getFullYear()}` },
        })
      }
    } else {
      // Remove overtime notification if balance resolved
      await deleteNotificationByMetadata(userId, { type: 'overtime' })
    }

    // Negative balance notification
    if (saldoMinutes < -60) {
      const alreadyNegative = existingMeta.some((m) => m?.type === 'negative_balance')
      if (!alreadyNegative) {
        const negHours = Math.floor(Math.abs(saldoMinutes) / 60)
        const negMins = Math.abs(saldoMinutes) % 60
        await createNotification(userId, {
          title: 'Saldo de horas negativo',
          message: `Seu banco de horas está negativo em -${negHours}h${negMins > 0 ? negMins + 'm' : ''}. Registre horas extras para compensar.`,
          type: 'WARNING',
          link: '/banco',
          metadata: { type: 'negative_balance', month: `${now.getMonth() + 1}/${now.getFullYear()}` },
        })
      }
    } else {
      await deleteNotificationByMetadata(userId, { type: 'negative_balance' })
    }
  } catch (err) {
    console.warn(`[Notifications] generateOvertimeNotification error for ${userId}:`, (err as Error)?.message)
  }
}

export async function generateAllSmartNotifications(userId: string) {
  await Promise.all([
    generateMissingClockInNotifications(userId),
    generateOvertimeNotification(userId),
  ])
}

// ─── Daily Scheduler ────────────────────────────────────────────────────────

export async function runDailyNotificationSchedule() {
  let users: { id: string; reportNotificationDay: number }[]
  try {
    users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, reportNotificationDay: true },
    })
  } catch (err) {
    console.warn('[Notifications] Schedule: tabela users não disponível (migration pendente?)', (err as Error)?.message)
    return
  }

  const today = new Date()
  const todayDay = today.getDate()
  const monthLabel = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  for (const user of users) {
    try {
      await generateAllSmartNotifications(user.id)

      // Monthly report notification
      if (user.reportNotificationDay === todayDay) {
        await generateMonthlyReportNotification(user.id, monthLabel)
      }
    } catch (err) {
      console.error(`[Notifications] Error processing user ${user.id}:`, err)
    }
  }
}
