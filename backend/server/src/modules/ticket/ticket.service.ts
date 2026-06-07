import { prisma } from '../../database/prisma.js'
import { supabaseAdmin } from '../../database/supabase.js'
import * as notificationService from '../notification/notification.service.js'
import type { TicketStatus, TicketCategory } from '../../generated/prisma/enums.js'

const BUCKET = 'tickets'
const MANAGER_ROLES = ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN', 'RH']

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    })
  }
}

const CATEGORY_ASSIGN: Record<string, string[]> = {
  SUPORTE_TECNICO: ['DEVELOPER'],
  JORNADA_E_PONTO: ['ADMIN'],
  RH_E_BENEFICIOS: ['RH', 'ADMIN'],
  ACESSO_E_PERMISSOES: ['DEVELOPER'],
  SUGESTOES_E_MELHORIAS: ['ADMIN'],
  OUTROS: ['ADMIN'],
}

async function findAssignee(companyId: string, category: string): Promise<string | null> {
  const roles = CATEGORY_ASSIGN[category]
  if (!roles || roles.length === 0) return null
  const user = await prisma.user.findFirst({
    where: { companyId, role: { in: roles as any }, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return user?.id || null
}

async function generateProtocol(companyId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SOL-${year}-`
  const last = await prisma.ticket.findFirst({
    where: {
      companyId,
      protocol: { startsWith: prefix },
    },
    orderBy: { protocol: 'desc' },
    select: { protocol: true },
  })
  const lastSeq = last ? parseInt(last.protocol.split('-')[2] || '0', 10) : 0
  const seq = String(lastSeq + 1).padStart(5, '0')
  return `${prefix}${seq}`
}

async function uploadFile(file: Express.Multer.File, ticketId: string): Promise<{ fileUrl: string; fileName: string; mimeType: string; fileSize: number }> {
  await ensureBucket()
  const ext = file.originalname.split('.').pop() || 'bin'
  const filePath = `tickets/${ticketId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  })
  if (error) throw Object.assign(new Error('Erro ao fazer upload do arquivo'), { statusCode: 500 })
  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath)
  return {
    fileUrl: urlData.publicUrl,
    fileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.buffer.length,
  }
}

export async function listTickets(userId: string, role: string, companyId: string) {
  const isManager = MANAGER_ROLES.includes(role)
  const where: any = { companyId }
  if (!isManager) where.userId = userId
  return prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      assignee: { select: { id: true, name: true, avatar: true } },
      _count: { select: { messages: true, attachments: true } },
    },
  })
}

export async function getTicketById(id: string, userId: string, role: string, companyId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, avatar: true, email: true } },
      assignee: { select: { id: true, name: true, avatar: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, avatar: true, role: true } },
        },
      },
      attachments: true,
    },
  })
  if (!ticket) return null
  if (ticket.companyId !== companyId) return null
  const isManager = MANAGER_ROLES.includes(role)
  if (!isManager && ticket.userId !== userId) return null
  return ticket
}

export async function createTicket(
  userId: string,
  companyId: string,
  data: { title: string; description: string; category: string; subcategory?: string },
  file?: Express.Multer.File,
) {
  const assignedTo = await findAssignee(companyId, data.category)

  let ticket
  let protocol
  for (let attempt = 0; attempt < 3; attempt++) {
    protocol = await generateProtocol(companyId)
    try {
      ticket = await prisma.ticket.create({
        data: {
          protocol,
          title: data.title,
          description: data.description,
          category: data.category as TicketCategory,
          subcategory: data.subcategory || '',
          userId,
          companyId,
          assignedTo,
        },
      })
      break
    } catch (err: any) {
      if (err.code === 'P2002' && attempt < 2) continue
      throw err
    }
  }

  if (file) {
    const fileData = await uploadFile(file, ticket!.id)
    await prisma.ticketAttachment.create({
      data: { ...fileData, ticketId: ticket!.id },
    })
  }

  prisma.activityLog.create({
    data: {
      userId,
      action: 'TICKET_CREATE',
      description: `Solicitação ${protocol} criada`,
      entityType: 'Ticket',
      entityId: ticket!.id,
      metadata: { category: data.category },
    },
  }).catch(() => {})

  if (assignedTo) {
    notificationService.createNotification(assignedTo, {
      title: 'Nova solicitação',
      message: `${ticket!.protocol} - ${ticket!.title}`,
      type: 'INFO',
      link: `/solicitacoes/${ticket!.id}`,
    }).catch(() => {})
  }

  return prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      user: { select: { id: true, name: true, avatar: true, email: true } },
      assignee: { select: { id: true, name: true, avatar: true, email: true } },
      attachments: true,
    },
  })
}

export async function addTicketMessage(
  ticketId: string,
  userId: string,
  role: string,
  companyId: string,
  message: string,
  file?: Express.Multer.File,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return null
  if (ticket.companyId !== companyId) return null
  const isManager = MANAGER_ROLES.includes(role)
  if (!isManager && ticket.userId !== userId) return null

  const msg = await prisma.ticketMessage.create({
    data: { ticketId, userId, message },
    include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
  })

  if (file) {
    const fileData = await uploadFile(file, ticketId)
    await prisma.ticketAttachment.create({
      data: { ...fileData, ticketId },
    })
  }

  if (ticket.status === 'AGUARDANDO_RESPOSTA' && isManager) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'EM_ANALISE' } })
  }
  if (ticket.status === 'EM_ANALISE' && !isManager) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'AGUARDANDO_RESPOSTA' } })
  }

  const notifyUserId = isManager ? ticket.userId : (ticket.assignedTo || ticket.userId)
  if (notifyUserId !== userId) {
    notificationService.createNotification(notifyUserId, {
      title: 'Nova mensagem',
      message: `${ticket.protocol} - ${message.slice(0, 100)}`,
      type: 'INFO',
      link: `/solicitacoes/${ticketId}`,
    }).catch(() => {})
  }

  prisma.activityLog.create({
    data: {
      userId,
      action: 'TICKET_MESSAGE',
      description: `Mensagem enviada em ${ticket.protocol}`,
      entityType: 'Ticket',
      entityId: ticketId,
    },
  }).catch(() => {})

  return msg
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
  message: string | undefined,
  userId: string,
  role: string,
  companyId: string,
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!ticket) return null
  if (ticket.companyId !== companyId) return null
  if (!MANAGER_ROLES.includes(role)) return null

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: status as TicketStatus },
    include: {
      user: { select: { id: true, name: true, avatar: true, email: true } },
      assignee: { select: { id: true, name: true, avatar: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
      },
      attachments: true,
    },
  })

  if (message) {
    await prisma.ticketMessage.create({
      data: { ticketId, userId, message },
    })
  }

  notificationService.createNotification(ticket.userId, {
    title: 'Solicitação atualizada',
    message: `${ticket.protocol} - Status: ${status}`,
    type: 'INFO',
    link: `/solicitacoes/${ticketId}`,
  }).catch(() => {})

  if (status === 'RESOLVIDO' || status === 'ENCERRADO') {
    const { sendTicketUpdateEmail } = await import('../../services/email.js')
    sendTicketUpdateEmail(
      ticket.user.email,
      ticket.user.name,
      ticket.protocol,
      ticket.title,
      status,
      message,
    ).catch(() => {})
  }

  prisma.activityLog.create({
    data: {
      userId,
      action: 'TICKET_STATUS',
      description: `Status de ${ticket.protocol} alterado para ${status}`,
      entityType: 'Ticket',
      entityId: ticketId,
      oldValue: ticket.status,
      newValue: status,
    },
  }).catch(() => {})

  return updated
}
