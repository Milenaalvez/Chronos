import { prisma } from '../../database/prisma.js'

export async function getConfig(companyId: string, actorRole: string, actorCompanyId: string) {
  if (actorRole !== 'SUPER_ADMIN' && companyId !== actorCompanyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  let config = await prisma.companyConfig.findUnique({ where: { companyId } })
  if (!config) {
    config = await prisma.companyConfig.create({ data: { companyId } })
  }
  return config
}

export async function updateConfig(companyId: string, data: {
  logo?: string
  primaryColor?: string
  requireGeo?: boolean
  requireFace?: boolean
  defaultWeeklyHours?: number
  lunchDuration?: number
}, actorRole: string, actorCompanyId: string) {
  if (actorRole !== 'SUPER_ADMIN' && companyId !== actorCompanyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  const existing = await prisma.companyConfig.findUnique({ where: { companyId } })
  if (!existing) {
    await prisma.companyConfig.create({ data: { companyId, ...data } })
  } else {
    await prisma.companyConfig.update({ where: { companyId }, data })
  }
  return prisma.companyConfig.findUnique({ where: { companyId } })
}
