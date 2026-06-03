import { prisma } from '../../database/prisma.js'

export async function listDepartments(companyId: string) {
  return prisma.department.findMany({
    where: { active: true, companyId },
    orderBy: { order: 'asc' },
    include: {
      positions: {
        where: { active: true },
        orderBy: { name: 'asc' },
      },
    },
  })
}

export async function listPositions(companyId: string, departmentId?: string) {
  const where: any = { active: true, companyId }
  if (departmentId) where.departmentId = departmentId
  return prisma.position.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { department: { select: { id: true, name: true, slug: true } } },
  })
}
