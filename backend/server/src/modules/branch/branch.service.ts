import { prisma } from '../../database/prisma.js'

export async function listBranches(companyId: string, actorRole: string, actorCompanyId: string) {
  if (actorRole !== 'SUPER_ADMIN' && companyId !== actorCompanyId) return []
  return prisma.branch.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true } },
    },
  })
}

export async function getBranch(id: string, actorCompanyId: string, actorRole: string) {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
    },
  })
  if (!branch) return null
  if (actorRole !== 'SUPER_ADMIN' && branch.companyId !== actorCompanyId) return null
  return branch
}

export async function createBranch(data: {
  name: string
  code?: string
  cnpj?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  responsible?: string
  companyId: string
}, actorRole: string, actorCompanyId: string) {
  if (actorRole !== 'SUPER_ADMIN' && data.companyId !== actorCompanyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  const company = await prisma.company.findUnique({ where: { id: data.companyId } })
  if (!company) {
    throw Object.assign(new Error('Empresa não encontrada'), { statusCode: 404 })
  }
  if (data.code) {
    const existing = await prisma.branch.findUnique({
      where: { companyId_code: { companyId: data.companyId, code: data.code } },
    })
    if (existing) {
      throw Object.assign(new Error('Já existe uma filial com este código nesta empresa'), { statusCode: 409 })
    }
  }
  return prisma.branch.create({
    data: {
      name: data.name,
      code: data.code || null,
      cnpj: data.cnpj || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      phone: data.phone || null,
      responsible: data.responsible || null,
      companyId: data.companyId,
    },
  })
}

export async function updateBranch(id: string, data: {
  name?: string
  code?: string
  cnpj?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  responsible?: string
  isActive?: boolean
}, actorCompanyId: string, actorRole: string) {
  const branch = await prisma.branch.findUnique({ where: { id } })
  if (!branch) {
    throw Object.assign(new Error('Filial não encontrada'), { statusCode: 404 })
  }
  if (actorRole !== 'SUPER_ADMIN' && branch.companyId !== actorCompanyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  if (data.code && data.code !== branch.code) {
    const existing = await prisma.branch.findUnique({
      where: { companyId_code: { companyId: branch.companyId, code: data.code } },
    })
    if (existing) {
      throw Object.assign(new Error('Já existe uma filial com este código nesta empresa'), { statusCode: 409 })
    }
  }
  return prisma.branch.update({
    where: { id },
    data,
  })
}

export async function deleteBranch(id: string, actorRole: string, actorCompanyId: string) {
  const branch = await prisma.branch.findUnique({ where: { id } })
  if (!branch) {
    throw Object.assign(new Error('Filial não encontrada'), { statusCode: 404 })
  }
  if (actorRole !== 'SUPER_ADMIN' && branch.companyId !== actorCompanyId) {
    throw Object.assign(new Error('Sem permissão'), { statusCode: 403 })
  }
  const userCount = await prisma.user.count({ where: { branchId: id } })
  if (userCount > 0) {
    throw Object.assign(new Error('Filial possui usuários. Reatribua-os antes de remover.'), { statusCode: 400 })
  }
  await prisma.branch.delete({ where: { id } })
  return { success: true }
}
