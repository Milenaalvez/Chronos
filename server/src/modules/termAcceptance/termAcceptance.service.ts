import { prisma } from '../../database/prisma.js'

export async function acceptTerms(userId: string, ip: string | undefined, userAgent: string | undefined) {
  const existing = await prisma.termAcceptance.findUnique({ where: { userId } })
  if (existing) {
    return existing
  }
  return prisma.termAcceptance.create({
    data: { userId, ip: ip || null, userAgent: userAgent || null },
  })
}

export async function getStatus(userId: string) {
  const acceptance = await prisma.termAcceptance.findUnique({ where: { userId } })
  return { accepted: !!acceptance, acceptance }
}
