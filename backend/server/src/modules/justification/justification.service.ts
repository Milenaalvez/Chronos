import { prisma } from '../../database/prisma.js'

export async function listJustifications(userId: string, role: string, companyId: string) {
  const where = role === 'ADMIN' || role === 'RH' || role === 'DEVELOPER'
    ? { user: { companyId } }
    : { userId, user: { companyId } }
  return prisma.justification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true, avatar: true, department: true } } },
  })
}

export async function createJustification(userId: string, data: {
  reason: string
  description?: string
  startDate: string
  endDate: string
  attachmentUrl?: string
}) {
  return prisma.justification.create({
    data: {
      userId,
      reason: data.reason,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      attachmentUrl: data.attachmentUrl,
    },
  })
}

export async function approveJustification(id: string, respondedBy: string, actorName: string) {
  const just = await prisma.justification.update({
    where: { id },
    data: { status: 'APPROVED' as any, respondedBy, rhResponse: 'Justificativa aprovada pelo RH.' },
  })
  await prisma.notification.create({
    data: {
      userId: just.userId,
      title: 'Justificativa aprovada',
      message: `${actorName} aprovou sua justificativa de "${just.reason}".`,
      type: 'APPROVAL' as any,
      link: '/justificativas',
    },
  })
  await prisma.activityLog.create({
    data: {
      userId: respondedBy,
      action: 'APPROVE_JUSTIFICATION',
      description: `${actorName} aprovou justificativa de "${just.reason}"`,
      entityType: 'Justification',
      entityId: just.id,
      targetUserId: just.userId,
      metadata: { actorName, reason: just.reason, status: 'APPROVED' },
    },
  }).catch(() => {})
  return just
}

export async function rejectJustification(id: string, respondedBy: string, actorName: string, rhResponse?: string) {
  const just = await prisma.justification.update({
    where: { id },
    data: { status: 'REJECTED' as any, respondedBy, rhResponse: rhResponse || 'Justificativa recusada.' },
  })
  await prisma.notification.create({
    data: {
      userId: just.userId,
      title: 'Justificativa recusada',
      message: `${actorName} recusou sua justificativa de "${just.reason}".${rhResponse ? ` Motivo: ${rhResponse}` : ''}`,
      type: 'WARNING' as any,
      link: '/justificativas',
    },
  })
  await prisma.activityLog.create({
    data: {
      userId: respondedBy,
      action: 'REJECT_JUSTIFICATION',
      description: `${actorName} recusou justificativa de "${just.reason}"`,
      entityType: 'Justification',
      entityId: just.id,
      targetUserId: just.userId,
      metadata: { actorName, reason: just.reason, status: 'REJECTED' },
    },
  }).catch(() => {})
  return just
}
