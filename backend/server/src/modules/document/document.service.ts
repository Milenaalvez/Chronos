import { prisma } from '../../database/prisma.js'
import { supabaseAdmin } from '../../database/supabase.js'

const BUCKET = 'documents'

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    })
  }
}

export async function uploadDocument(
  userId: string,
  uploadedBy: string,
  companyId: string,
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  data: { name: string; type: string; category: string; notes?: string },
) {
  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } })
  if (!targetUser) throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 })
  if (targetUser.companyId !== companyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }

  await ensureBucket()

  const ext = fileName.split('.').pop() || 'pdf'
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw Object.assign(new Error('Erro ao fazer upload do documento'), { statusCode: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(filePath)

  const doc = await prisma.document.create({
    data: {
      name: data.name,
      type: data.type,
      category: data.category,
      fileUrl: urlData.publicUrl,
      fileSize: fileBuffer.length,
      mimeType,
      notes: data.notes || null,
      userId,
      uploadedBy,
    },
  })

  prisma.activityLog.create({
    data: {
      userId: uploadedBy,
      action: 'DOCUMENT_CREATE',
      description: `Documento "${data.name}" enviado`,
      entityType: 'Document',
      entityId: doc.id,
      targetUserId: userId,
      metadata: { category: data.category, type: data.type },
    },
  }).catch(() => {})

  return doc
}

export async function listDocuments(userId: string, companyId: string, actorId?: string) {
  const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { role: true, companyId: true } }) : null
  const isManager = actor?.role === 'ADMIN' || actor?.role === 'RH' || actor?.role === 'DEVELOPER'
  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } })
  if (!targetUser) return []
  if (targetUser.companyId !== companyId && !isManager) return []

  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      uploader: { select: { id: true, name: true, avatar: true, role: true } },
    },
  })
}

export async function deleteDocument(id: string, userId: string, actorId: string, actorRole: string, actorCompanyId: string) {
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return false

  const targetUser = await prisma.user.findUnique({ where: { id: doc.userId }, select: { companyId: true } })
  if (!targetUser || targetUser.companyId !== actorCompanyId) return false

  if (doc.userId !== userId && actorRole !== 'ADMIN' && actorRole !== 'RH' && actorRole !== 'DEVELOPER' && actorRole !== 'SUPER_ADMIN') return false
  if (doc.uploadedBy !== actorId && actorRole !== 'ADMIN' && actorRole !== 'RH' && actorRole !== 'DEVELOPER' && actorRole !== 'SUPER_ADMIN') return false

  await prisma.document.delete({ where: { id } }).catch(() => {})

  prisma.activityLog.create({
    data: {
      userId: actorId,
      action: 'DOCUMENT_DELETE',
      description: `Documento "${doc.name}" removido`,
      entityType: 'Document',
      entityId: id,
      targetUserId: userId,
    },
  }).catch(() => {})

  return true
}
