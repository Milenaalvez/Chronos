import { supabaseAdmin } from '../../database/supabase.js'
import { prisma } from '../../database/prisma.js'

const BUCKET = 'avatars'

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
    })
  }
}

export async function uploadAvatar(userId: string, fileBuffer: Buffer, mimeType: string) {
  await ensureBucket()

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const filePath = `${userId}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    throw Object.assign(new Error('Erro ao fazer upload da imagem'), { statusCode: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(filePath)

  const avatarUrl = urlData.publicUrl

  await prisma.user.update({
    where: { id: userId },
    data: { avatar: avatarUrl },
  })

  return { avatarUrl }
}
