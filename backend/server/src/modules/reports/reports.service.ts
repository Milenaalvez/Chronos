import { prisma } from '../../database/prisma.js'

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

export async function getConsolidated(
  companyId: string,
  filters: {
    year: number
    month: number
    departmentId?: string
    positionId?: string
    collaboratorId?: string
    status?: string
  }
) {
  const { start, end } = monthBounds(filters.year, filters.month)
  const userWhere: any = { companyId, isActive: true }
  if (filters.departmentId) userWhere.departmentId = filters.departmentId
  if (filters.positionId) userWhere.positionId = filters.positionId
  if (filters.collaboratorId) userWhere.id = filters.collaboratorId

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, email: true, department: true, departmentId: true,
      position: true, positionId: true, role: true, contractType: true,
      weeklyHours: true, hireDate: true, isActive: true,
    },
    orderBy: { name: 'asc' },
  })

  const userIds = users.map(u => u.id)

  const [records, justifications, closing] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { userId: { in: userIds }, date: { gte: start, lte: end } },
      select: { userId: true, date: true, clockIn: true, clockOut: true, totalMinutes: true, overtimeMinutes: true, status: true, reviewStatus: true },
    }),
    prisma.justification.findMany({
      where: { userId: { in: userIds }, startDate: { lte: end }, endDate: { gte: start } },
      select: { userId: true, reason: true, status: true, startDate: true, endDate: true },
    }),
    prisma.monthClosing.findUnique({
      where: { companyId_year_month: { companyId, year: filters.year, month: filters.month } },
    }),
  ])

  const recordsByUser = new Map<string, typeof records>()
  for (const r of records) {
    if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, [])
    recordsByUser.get(r.userId)!.push(r)
  }

  const justsByUser = new Map<string, typeof justifications>()
  for (const j of justifications) {
    if (!justsByUser.has(j.userId)) justsByUser.set(j.userId, [])
    justsByUser.get(j.userId)!.push(j)
  }

  const totalDaysInMonth = end.getDate()
  const weekdayCount = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const d = new Date(filters.year, filters.month - 1, i + 1)
    return d.getDay() !== 0 && d.getDay() !== 6 ? 1 : 0
  }).reduce((a, b) => a + b, 0)

  const rows = users.map(user => {
    const userRecords = recordsByUser.get(user.id) || []
    const userJusts = justsByUser.get(user.id) || []

    const daysWithRecord = new Set(userRecords.filter(r => r.clockIn).map(r => r.date.toISOString().split('T')[0]))
    const totalMins = userRecords.reduce((s, r) => s + (r.totalMinutes || 0), 0)
    const extraMins = userRecords.reduce((s, r) => s + (r.overtimeMinutes || 0), 0)
    const expectedMins = user.weeklyHours / 5 * weekdayCount * 60
    const balanceMins = totalMins - expectedMins
    const absences = weekdayCount - daysWithRecord.size
    const lates = userRecords.filter(r => r.status === 'ABSENCE').length
    const pendingJusts = userJusts.filter(j => j.status === 'PENDING').length
    const approvedJusts = userJusts.filter(j => j.status === 'APPROVED').length

    let status: 'ok' | 'alerta' | 'pendente' | 'incompleto' = 'ok'
    if (absences > 0 || lates > 0) status = 'alerta'
    if (pendingJusts > 0) status = 'pendente'
    if (!userRecords.some(r => r.clockIn)) status = 'incompleto'

    if (filters.status) {
      if (filters.status === 'ok' && status !== 'ok') return null
      if (filters.status === 'alerta' && status !== 'alerta') return null
      if (filters.status === 'pendente' && status !== 'pendente') return null
      if (filters.status === 'incompleto' && status !== 'incompleto') return null
    }

    return {
      userId: user.id,
      colaborador: user.name,
      email: user.email,
      departamento: user.department || '---',
      cargo: user.position || '---',
      contrato: user.contractType || '---',
      horasTrabalhadas: totalMins,
      horasExtras: extraMins,
      saldoBanco: balanceMins,
      faltas: Math.max(0, absences),
      atrasos: lates,
      diasTrabalhados: daysWithRecord.size,
      diasUteis: weekdayCount,
      justificativasPendentes: pendingJusts,
      justificativasAprovadas: approvedJusts,
      status,
      registros: userRecords.map(r => ({
        data: r.date.toISOString().split('T')[0],
        entrada: r.clockIn,
        saida: r.clockOut,
        totalMinutos: r.totalMinutes,
        extraMinutos: r.overtimeMinutes,
        status: r.status,
        reviewStatus: r.reviewStatus,
      })),
      justificativas: userJusts.map(j => ({
        motivo: j.reason,
        status: j.status,
        inicio: j.startDate.toISOString().split('T')[0],
        fim: j.endDate.toISOString().split('T')[0],
      })),
    }
  }).filter(Boolean)

  const totalMinsAll = rows.reduce((s, r) => s + r!.horasTrabalhadas, 0)
  const extraMinsAll = rows.reduce((s, r) => s + r!.horasExtras, 0)
  const balanceMinsAll = rows.reduce((s, r) => s + r!.saldoBanco, 0)
  const absencesAll = rows.reduce((s, r) => s + r!.faltas, 0)
  const latesAll = rows.reduce((s, r) => s + r!.atrasos, 0)
  const comRegistros = rows.filter(r => r!.diasTrabalhados > 0).length

  return {
    rows,
    indicadores: {
      horasTrabalhadas: totalMinsAll,
      horasExtras: extraMinsAll,
      saldoBanco: balanceMinsAll,
      colaboradoresComRegistros: comRegistros,
      ausencias: absencesAll,
      atrasos: latesAll,
      diasUteis: weekdayCount,
      totalColaboradores: rows.length,
    },
    fechamento: closing ? { status: closing.status, closedAt: closing.closedAt, closedBy: closing.closedBy } : { status: 'open', closedAt: null, closedBy: null },
  }
}

export async function getClosingStatus(companyId: string, year: number, month: number) {
  const closing = await prisma.monthClosing.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  })
  return closing ? { status: closing.status, closedAt: closing.closedAt, closedBy: closing.closedBy } : { status: 'open', closedAt: null, closedBy: null }
}

export async function closeMonth(companyId: string, year: number, month: number, closedByUserId: string) {
  const existing = await prisma.monthClosing.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  })
  if (existing?.status === 'closed') throw new Error('Competência já está fechada')

  const data = {
    companyId,
    year,
    month,
    status: 'closed' as const,
    closedAt: new Date(),
    closedBy: closedByUserId,
  }

  await prisma.monthClosing.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    create: data,
    update: data,
  })

  const closer = await prisma.user.findUnique({ where: { id: closedByUserId }, select: { name: true } })
  await prisma.activityLog.create({
    data: {
      userId: closedByUserId,
      action: 'CLOSE_MONTH',
      description: `${closer?.name || 'Sistema'} fechou a competência ${month}/${year}`,
      entityType: 'MonthClosing',
      metadata: { companyId, year, month, action: 'close' },
    },
  }).catch(() => {})

  return { ok: true, status: 'closed' }
}

export async function reopenMonth(companyId: string, year: number, month: number, reopenedByUserId: string) {
  const existing = await prisma.monthClosing.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  })
  if (!existing || existing.status !== 'closed') throw new Error('Competência não está fechada')

  await prisma.monthClosing.update({
    where: { companyId_year_month: { companyId, year, month } },
    data: { status: 'open', reopenedAt: new Date(), reopenedBy: reopenedByUserId },
  })

  const reopener = await prisma.user.findUnique({ where: { id: reopenedByUserId }, select: { name: true } })
  await prisma.activityLog.create({
    data: {
      userId: reopenedByUserId,
      action: 'REOPEN_MONTH',
      description: `${reopener?.name || 'Sistema'} reabriu a competência ${month}/${year}`,
      entityType: 'MonthClosing',
      metadata: { companyId, year, month, action: 'reopen' },
    },
  }).catch(() => {})

  return { ok: true, status: 'open' }
}

export async function getAuditLog(companyId: string, year: number, month: number) {
  const logs = await prisma.activityLog.findMany({
    where: {
      entityType: 'MonthClosing',
      OR: [
        { user: { companyId } },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
    include: {
      user: { select: { id: true, name: true } },
    },
  })
  return logs
    .filter(log => {
      const meta = log.metadata as Record<string, unknown> | null
      return meta && meta.companyId === companyId && meta.year === year && meta.month === month
    })
    .map(log => ({
      action: log.action,
      user: log.user?.name || 'Sistema',
      timestamp: log.timestamp,
    }))
}
