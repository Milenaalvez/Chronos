import { prisma } from '../../database/prisma.js'

export async function listCompanies(actorRole: string) {
  if (actorRole === 'SUPER_ADMIN') {
    return prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, branches: true } },
        config: true,
      },
    })
  }
  return []
}

export async function getCompany(id: string, actorCompanyId: string, actorRole: string) {
  if (actorRole === 'SUPER_ADMIN') {
    return prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, branches: true } },
        config: true,
      },
    })
  }
  if (id !== actorCompanyId) return null
  return prisma.company.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, branches: true } },
      config: true,
    },
  })
}

export async function createCompany(data: {
  name: string
  slug: string
  document?: string
  phone?: string
  address?: string
  plan?: string
  userLimit?: number
}) {
  const existing = await prisma.company.findUnique({ where: { slug: data.slug } })
  if (existing) {
    throw Object.assign(new Error('Já existe uma empresa com este slug'), { statusCode: 409 })
  }
  return prisma.company.create({
    data: {
      name: data.name,
      slug: data.slug,
      document: data.document || null,
      phone: data.phone || null,
      address: data.address || null,
      plan: data.plan || 'starter',
      userLimit: data.userLimit || 20,
      config: {
        create: {},
      },
    },
    include: { config: true },
  })
}

export async function updateCompany(id: string, data: {
  name?: string
  slug?: string
  document?: string
  phone?: string
  address?: string
  logo?: string
  plan?: string
  userLimit?: number
  status?: string
}, actorCompanyId: string, actorRole: string) {
  if (actorRole !== 'SUPER_ADMIN' && id !== actorCompanyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  if (data.slug) {
    const existing = await prisma.company.findFirst({
      where: { slug: data.slug, id: { not: id } },
    })
    if (existing) {
      throw Object.assign(new Error('Já existe uma empresa com este slug'), { statusCode: 409 })
    }
  }
  return prisma.company.update({
    where: { id },
    data,
  })
}

export async function deleteCompany(id: string, actorRole: string) {
  if (actorRole !== 'SUPER_ADMIN') {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  const userCount = await prisma.user.count({ where: { companyId: id } })
  if (userCount > 0) {
    throw Object.assign(new Error('Empresa possui usuários ativos. Remova-os primeiro.'), { statusCode: 400 })
  }
  await prisma.companyConfig.deleteMany({ where: { companyId: id } })
  await prisma.branch.deleteMany({ where: { companyId: id } })
  await prisma.department.deleteMany({ where: { companyId: id } })
  await prisma.position.deleteMany({ where: { companyId: id } })
  await prisma.company.delete({ where: { id } })
  return { success: true }
}
