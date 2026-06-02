import { prisma } from '../../database/prisma.js'

export async function registerFace(userId: string, descriptors: number[][], images: string[]) {
  const existing = await prisma.faceRegistration.findUnique({ where: { userId } })
  if (existing) {
    return prisma.faceRegistration.update({
      where: { userId },
      data: {
        descriptors: descriptors,
        images: images,
        status: 'COMPLETED',
      },
    })
  }
  return prisma.faceRegistration.create({
    data: {
      userId,
      descriptors: descriptors,
      images: images,
      status: 'COMPLETED',
    },
  })
}

export async function getRegistration(userId: string) {
  return prisma.faceRegistration.findUnique({ where: { userId } })
}

export async function getDescriptors(userId: string) {
  const reg = await prisma.faceRegistration.findUnique({
    where: { userId },
    select: { descriptors: true, status: true },
  })
  return reg
}
