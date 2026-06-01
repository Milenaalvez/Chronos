import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const users = await prisma.user.findMany({
    where: { registrationNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true },
  })

  if (users.length === 0) {
    console.log('Nenhum usuário sem matrícula encontrado.')
    return
  }

  const last = await prisma.user.findFirst({
    where: { registrationNumber: { not: null } },
    orderBy: { registrationNumber: 'desc' },
    select: { registrationNumber: true },
  })

  let nextNum = last?.registrationNumber ? Number(last.registrationNumber) + 1 : 10001

  console.log(`Gerando matrículas para ${users.length} usuário(s)...\n`)

  for (const user of users) {
    const regNum = String(nextNum)
    await prisma.user.update({
      where: { id: user.id },
      data: { registrationNumber: regNum },
    })
    console.log(`  #${regNum} → ${user.name}`)
    nextNum++
  }

  console.log(`\n✅ ${users.length} matrículas geradas com sucesso.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
