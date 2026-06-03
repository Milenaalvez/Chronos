import 'dotenv/config'
import { PrismaClient } from '../server/src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const NOW = new Date()
const YEAR = NOW.getFullYear()
const MONTH = 5 // May

function workingDays(year: number, month: number) {
  const days: number[] = []
  const total = new Date(year, month, 0).getDate()
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) days.push(d)
  }
  return days
}

function pad(n: number) { return String(n).padStart(2, "0") }

const USERS = [
  { name: "Ana Silva", email: "ana@chronos.test", role: "RH" as const, dept: "recursos-humanos", position: "Analista de RH", weeklyHours: 40 },
  { name: "Carlos Oliveira", email: "carlos@chronos.test", role: "ADMIN" as const, dept: "administrativo", position: "Coordenador Administrativo", weeklyHours: 40 },
  { name: "Beatriz Santos", email: "beatriz@chronos.test", role: "EMPLOYEE" as const, dept: "tecnologia", position: "Desenvolvedor Front-end Pleno", weeklyHours: 40 },
  { name: "Diego Costa", email: "diego@chronos.test", role: "EMPLOYEE" as const, dept: "tecnologia", position: "Desenvolvedor Back-end Pleno", weeklyHours: 44 },
  { name: "Fernanda Lima", email: "fernanda@chronos.test", role: "EMPLOYEE" as const, dept: "financeiro", position: "Analista Financeiro", weeklyHours: 40 },
  { name: "Gabriel Souza", email: "gabriel@chronos.test", role: "EMPLOYEE" as const, dept: "comercial", position: "Consultor Comercial", weeklyHours: 40 },
  { name: "Helena Martins", email: "helena@chronos.test", role: "EMPLOYEE" as const, dept: "marketing", position: "Designer Gráfico", weeklyHours: 36 },
  { name: "Igor Pereira", email: "igor@chronos.test", role: "EMPLOYEE" as const, dept: "suporte-tecnico", position: "Técnico de Suporte N2", weeklyHours: 40 },
]

function makeTime(day: number, hour: number, min = 0) {
  return `${pad(hour)}:${pad(min)}`
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log("🚀 Creating test data...\n")

  // 1. Company
  const company = await prisma.company.upsert({
    where: { slug: "chronos-test" },
    update: {},
    create: { name: "Chronos Test", slug: "chronos-test", document: "00.000.000/0001-00" },
  })
  console.log(`✅ Company: ${company.name} (${company.id})`)

  // 2. Departments & positions from seed
  const departments: { slug: string; name: string; positions: string[] }[] = [
    { slug: "tecnologia", name: "Tecnologia", positions: ["Desenvolvedor Front-end Pleno", "Desenvolvedor Back-end Pleno"] },
    { slug: "recursos-humanos", name: "Recursos Humanos", positions: ["Analista de RH"] },
    { slug: "administrativo", name: "Administrativo", positions: ["Coordenador Administrativo"] },
    { slug: "financeiro", name: "Financeiro", positions: ["Analista Financeiro"] },
    { slug: "comercial", name: "Comercial", positions: ["Consultor Comercial"] },
    { slug: "marketing", name: "Marketing", positions: ["Designer Gráfico"] },
    { slug: "suporte-tecnico", name: "Suporte Técnico", positions: ["Técnico de Suporte N2"] },
  ]

  const deptMap = new Map<string, string>()
  const posMap = new Map<string, string>()

  for (const d of departments) {
    const dept = await prisma.department.upsert({
      where: { slug: d.slug },
      update: { name: d.name },
      create: { slug: d.slug, name: d.name },
    })
    deptMap.set(d.slug, dept.id)
    for (const p of d.positions) {
      const slug = p.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      const pos = await prisma.position.upsert({
        where: { slug },
        update: { name: p, departmentId: dept.id },
        create: { slug, name: p, departmentId: dept.id },
      })
      posMap.set(p, pos.id)
    }
  }
  console.log(`✅ ${departments.length} departamentos sincronizados`)

  // 3. Create users
  const password = await bcrypt.hash("123456", 10)
  const userIds: string[] = []

  for (const u of USERS) {
    const deptId = deptMap.get(u.dept) || null
    const posId = posMap.get(u.position) || null
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password,
        name: u.name,
        role: u.role,
        department: departments.find(d => d.slug === u.dept)?.name || null,
        departmentId: deptId,
        position: u.position,
        positionId: posId,
        contractType: "CLT",
        weeklyHours: u.weeklyHours,
        workSchedule: "Seg-Sex",
        hireDate: new Date("2024-01-15"),
        companyId: company.id,
        emailVerified: true,
        isActive: true,
      },
    })
    userIds.push(user.id)
    console.log(`  👤 ${user.name.padEnd(20)} ${u.email.padEnd(25)} ${u.role.padEnd(10)} ${u.position}`)
  }

  // 4. Time records for May 2026 (bulk insert)
  const days = workingDays(YEAR, MONTH)

  // Clear existing records for our test users
  await prisma.timeRecord.deleteMany({ where: { userId: { in: userIds } } })

  const clockPatterns = [
    { in: 7, inMin: 50, outFinal: 17, outFinalMin: 0 },
    { in: 8, inMin: 0, outFinal: 18, outFinalMin: 0 },
    { in: 8, inMin: 10, outFinal: 17, outFinalMin: 30 },
    { in: 7, inMin: 30, outFinal: 16, outFinalMin: 30 },
    { in: 9, inMin: 0, outFinal: 18, outFinalMin: 0 },
    { in: 8, inMin: 0, outFinal: 17, outFinalMin: 0 },
    { in: 8, inMin: 15, outFinal: 17, outFinalMin: 45 },
    { in: 8, inMin: 0, outFinal: 18, outFinalMin: 0 },
  ]

  const allRecords: any[] = []

  for (let ui = 0; ui < userIds.length; ui++) {
    const pattern = clockPatterns[ui % clockPatterns.length]
    const weeklyMins = Math.round(USERS[ui].weeklyHours / 5 * 60)
    for (const day of days) {
      if (ui === 5 && (day === 5 || day === 12)) continue // Gabriel faltou 2 dias
      if (ui === 6 && day > 20) continue // Helena entrou depois

      const isLate = ui === 7 && (day === 8 || day === 22)
      const clockIn = isLate ? makeTime(8, randomInt(30, 50)) : makeTime(pattern.in, pattern.inMin)
      const clockOut = makeTime(pattern.outFinal, pattern.outFinalMin)
      const totalMin = isLate ? 480 + randomInt(-20, 20) : 480 + randomInt(-10, 30)
      const extra = Math.max(0, totalMin - weeklyMins)

      allRecords.push({
        userId: userIds[ui],
        clockIn,
        clockOut,
        totalMinutes: totalMin,
        overtimeMinutes: extra,
        date: new Date(YEAR, MONTH - 1, day),
        status: extra > 30 ? "OVERTIME" : "NORMAL",
      })
    }
  }

  // Batch insert — PostgreSQL handles conflicts gracefully
  for (let i = 0; i < allRecords.length; i += 50) {
    const batch = allRecords.slice(i, i + 50)
    await prisma.timeRecord.createMany({ data: batch, skipDuplicates: true })
  }

  console.log(`✅ ${allRecords.length} registros de ponto criados para ${MONTH}/${YEAR}`)

  // 5. Some justifications
  await prisma.justification.createMany({
    data: [
      {
        userId: userIds[5], // Gabriel
        reason: "Consulta médica",
        description: "Fui ao médico no dia 05/05, anexo atestado.",
        status: "APPROVED",
        startDate: new Date(YEAR, MONTH - 1, 5),
        endDate: new Date(YEAR, MONTH - 1, 5),
      },
      {
        userId: userIds[5], // Gabriel
        reason: "Problema pessoal",
        description: "Precisei resolver uma emergência no dia 12/05.",
        status: "PENDING",
        startDate: new Date(YEAR, MONTH - 1, 12),
        endDate: new Date(YEAR, MONTH - 1, 12),
      },
    ],
    skipDuplicates: true,
  })

  console.log("✅ 2 justificativas criadas")

  // 6. Create closing record for this month
  const closing = await prisma.monthClosing.upsert({
    where: { companyId_year_month: { companyId: company.id, year: YEAR, month: MONTH } },
    update: {},
    create: {
      companyId: company.id,
      year: YEAR,
      month: MONTH,
      status: "open",
    },
  })

  console.log(`✅ Fechamento: ${closing.status}\n`)
  console.log("╔══════════════════════════════════════════╗")
  console.log("║          TEST DATA CREATED!              ║")
  console.log("╠══════════════════════════════════════════╣")
  console.log("║  Login: qualquer email acima            ║")
  console.log("║  Senha: 123456                           ║")
  console.log("║  Mês:   Maio/2026                        ║")
  console.log("╚══════════════════════════════════════════╝")

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
