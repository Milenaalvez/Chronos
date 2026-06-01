import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'configurada' : 'AUSENTE')

  // Find Milena
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'Milena', mode: 'insensitive' } },
  })

  if (!user) {
    console.log('Usuária Milena não encontrada')
    await prisma.$disconnect()
    return
  }

  console.log('=== USUÁRIA ENCONTRADA ===')
  console.log(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hireDate: user.hireDate?.toISOString().split('T')[0],
    department: user.department,
    position: user.position,
    weeklyHours: user.weeklyHours,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
  }, null, 2))

  // Get all time records (totalMinutes is already computed by backend)
  const records = await prisma.timeRecord.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' },
  })

  console.log(`\n=== REGISTROS DE PONTO (${records.length}) ===`)
  let totalActualMins = 0
  let recordsWithClockOut = 0
  let recordsWithoutClockOut = 0

  for (const r of records) {
    const dateStr = r.date.toISOString().split('T')[0]
    const dayOfWeek = r.date.getDay()
    const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayOfWeek]
    const hasClockOut = !!r.clockOut
    const actual = (r.totalMinutes || 0)

    console.log(
      `${dateStr} (${dayName}) ` +
      `In: ${r.clockIn || '---'} Out: ${r.clockOut || '---'} ` +
      `Total: ${actual}min (${(actual/60).toFixed(1)}h) ` +
      `Status: ${r.status} `
    )

    if (hasClockOut) {
      recordsWithClockOut++
      totalActualMins += actual
    } else {
      recordsWithoutClockOut++
    }
  }

  // Get all justifications
  const justifications = await prisma.justification.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
  })

  console.log(`\n=== JUSTIFICATIVAS (${justifications.length}) ===`)
  let approvedDayCount = 0
  for (const j of justifications) {
    const start = j.startDate.toISOString().split('T')[0]
    const end = j.endDate.toISOString().split('T')[0]
    console.log(`${start} -> ${end} | Motivo: ${j.reason} | Status: ${j.status}`)
    // Count working days in range
    const s = new Date(j.startDate)
    const e = new Date(j.endDate)
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        if (j.status === 'aprovado') approvedDayCount++
      }
    }
  }
  console.log(`Dias úteis com justificativa aprovada: ${approvedDayCount}`)

  // Calculate what the system SHOULD show
  const hireDate = user.hireDate!
  const today = new Date()
  let totalWorkingDays = 0
  const workingDayISOs = new Set<string>()
  for (let d = new Date(hireDate); d <= today; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      totalWorkingDays++
      workingDayISOs.add(d.toISOString().split('T')[0])
    }
  }

  // Days with actual records (has clockOut)
  const recordedDaysSet = new Set<string>()
  for (const r of records) {
    if (r.clockOut) {
      recordedDaysSet.add(r.date.toISOString().split('T')[0])
    }
  }

  const missingDays = totalWorkingDays - recordedDaysSet.size
  const missingUnjustifiedDays = missingDays - approvedDayCount

  console.log(`\n=== CÁLCULO COMPLETO ===`)
  console.log(`Dias úteis desde admissão (${user.hireDate!.toISOString().split('T')[0]} até hoje): ${totalWorkingDays}`)
  console.log(`Dias com registro (clockOut): ${recordedDaysSet.size} (${recordsWithClockOut} registros)`)
  console.log(`Registros sem clockOut: ${recordsWithoutClockOut}`)
  console.log(`Dias úteis faltantes: ${missingDays}`)
  console.log(`Dias justificados (aprovados): ${approvedDayCount}`)
  console.log(`Dias faltantes sem justificativa: ${missingUnjustifiedDays}`)
  console.log(`\nHoras trabalhadas (reais): ${(totalActualMins / 60).toFixed(1)}h`)
  console.log(`Horas esperadas (total dias úteis * 8h): ${(totalWorkingDays * 8).toFixed(1)}h`)
  console.log(`Horas esperadas (com justif.): ${((totalWorkingDays - approvedDayCount) * 8).toFixed(1)}h`)
  console.log(`Saldo SEM justificativas: ${((totalActualMins - totalWorkingDays * 480) / 60).toFixed(1)}h`)
  console.log(`Saldo COM justificativas (abonar ${approvedDayCount} dias): ${((totalActualMins - (totalWorkingDays - approvedDayCount) * 480) / 60).toFixed(1)}h`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Erro:', e?.message || e)
  if (e?.meta) console.error('Meta:', e.meta)
  process.exit(1)
})
