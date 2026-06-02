import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../../database/prisma.js'
import { supabaseAdmin } from '../../database/supabase.js'
import { generateCode } from '../../utils/code.js'
import { sendWelcomeEmail } from '../../services/email.js'
import { env } from '../../config/env.js'
import { createNotification } from '../notification/notification.service.js'

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function calcMinutes(rec: { totalMinutes: number | null; clockIn: string | null; clockOut: string | null; breakStart?: string | null; breakEnd?: string | null }): number {
  if (rec.totalMinutes != null) return rec.totalMinutes
  if (!rec.clockIn || !rec.clockOut) return 0
  const start = toMinutes(rec.clockIn)
  const end = toMinutes(rec.clockOut)
  let total = end - start
  if (rec.breakStart && rec.breakEnd) {
    total -= (toMinutes(rec.breakEnd) - toMinutes(rec.breakStart))
  }
  return Math.max(0, total)
}

function countWorkingDays(year: number, month: number, afterDate?: Date): number {
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    if (afterDate && date < afterDate) continue
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export async function generateRegistrationNumber(): Promise<string> {
  const { prisma } = await import('../../database/prisma.js')
  const last = await prisma.user.findFirst({
    where: { registrationNumber: { not: null } },
    orderBy: { registrationNumber: 'desc' },
    select: { registrationNumber: true },
  })
  const nextNum = last?.registrationNumber ? Number(last.registrationNumber) + 1 : 10001
  return String(nextNum)
}

function logAction(userId: string, action: string, description: string, entityType: string, entityId: string, targetUserId?: string, metadata?: any) {
  return prisma.activityLog.create({
    data: { userId, action, description, entityType, entityId, targetUserId, metadata: metadata || {} },
  }).catch(() => {})
}

async function canViewAll(actorId?: string) {
  if (!actorId) return false
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true, permissions: true } })
  if (!actor) return false
  const { getEffectivePermissions } = await import('../../utils/permissions.js')
  return getEffectivePermissions(actor.role, actor.permissions as string[] | null).includes('switch_accounts')
}

export async function listTeam(companyId: string, actorId?: string) {
  const where = (await canViewAll(actorId)) ? {} : { companyId }
  return prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, role: true, department: true,
      position: true, contractType: true, phone: true, avatar: true,
      employeeCode: true, registrationNumber: true, weeklyHours: true, workSchedule: true,
      hireDate: true, isActive: true, emailVerified: true, lastAccessAt: true,
      companyId: true,
    },
  })
}

export async function getTeamMember(id: string, companyId: string, actorId?: string) {
  const canAll = await canViewAll(actorId)
  const where: any = { id }
  if (!canAll) where.companyId = companyId
  const user = await prisma.user.findFirst({
    where,
    select: {
      id: true, name: true, email: true, role: true, department: true,
      position: true, contractType: true, phone: true, cpf: true, avatar: true,
      employeeCode: true, registrationNumber: true, weeklyHours: true, workSchedule: true,
      hireDate: true, isActive: true, emailVerified: true, lastAccessAt: true,
      companyId: true,
      timeRecords: { orderBy: { date: 'desc' }, take: 10 },
    },
  })
  return user
}

export async function createTeamMember(companyId: string, data: {
  name: string
  email: string
  role?: string
  department?: string
  departmentId?: string
  position?: string
  positionId?: string
  contractType?: string
  weeklyHours?: number
  workSchedule?: string
  hireDate?: string
  employeeCode?: string
  phone?: string
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } })
  if (existing) {
    throw Object.assign(new Error('Este email já está cadastrado'), { statusCode: 409 })
  }

  const tempPassword = generateCode() + 'Aa1'
  const hashed = await bcrypt.hash(tempPassword, 10)
  const registrationNumber = await generateRegistrationNumber()

  let deptName = data.department
  let posName = data.position
  if (data.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } })
    if (dept) deptName = dept.name
  }
  if (data.positionId) {
    const pos = await prisma.position.findUnique({ where: { id: data.positionId } })
    if (pos) posName = pos.name
  }

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password: hashed,
      phone: data.phone || null,
      role: (data.role as any) || 'EMPLOYEE',
      department: deptName || null,
      departmentId: data.departmentId || null,
      position: posName || null,
      positionId: data.positionId || null,
      contractType: (data.contractType as any) || null,
      weeklyHours: data.weeklyHours || 40,
      workSchedule: data.workSchedule || 'Seg-Sex',
      hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
      employeeCode: data.employeeCode || null,
      registrationNumber,
      companyId,
    },
  })

  const verificationCode = crypto.randomBytes(32).toString('hex')
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode, verificationExpiresAt },
  })

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  sendWelcomeEmail(
    user.email,
    user.name,
    registrationNumber,
    data.position || data.role || 'Membro',
    company?.name || 'Empresa',
    `${env.appUrl}/?action=verify-email&token=${verificationCode}`
  ).catch(() => {})

  createNotification(user.id, {
    title: 'Bem-vindo ao Chronos',
    message: 'Sua conta foi criada com sucesso. Seus registros de jornada começarão a ser contabilizados a partir da sua data de admissão.',
    type: 'INFO',
  }).catch(() => {})

  try {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email.toLowerCase().trim(),
      { data: { name: data.name.trim() } }
    )
    if (error) {
      console.warn('[Team] Erro ao enviar convite Supabase:', error.message)
    }
  } catch (err: any) {
    console.warn('[Team] Erro ao enviar convite Supabase:', err?.message)
  }

  return { user, tempPassword }
}

export async function updateTeamMember(id: string, companyId: string, actorId: string, data: {
  name?: string
  role?: string
  department?: string
  departmentId?: string
  position?: string
  positionId?: string
  contractType?: string
  weeklyHours?: number
  workSchedule?: string
  isActive?: boolean
  phone?: string
  employeeCode?: string
  hireDate?: string
}) {
  const where = (await canViewAll(actorId)) ? { id } : { id, companyId }
  const user = await prisma.user.findFirst({ where })
  if (!user) return null

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.role ? { role: data.role as any } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
      ...(data.positionId !== undefined ? { positionId: data.positionId || null } : {}),
      ...(data.contractType ? { contractType: data.contractType as any } : {}),
      ...(typeof data.weeklyHours === 'number' ? { weeklyHours: data.weeklyHours } : {}),
      ...(data.workSchedule ? { workSchedule: data.workSchedule } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.employeeCode !== undefined ? { employeeCode: data.employeeCode } : {}),
      ...(data.hireDate ? { hireDate: new Date(data.hireDate) } : {}),
    },
  })

  const changes: string[] = []
  if (data.role && data.role !== user.role) {
    changes.push(`cargo alterado de ${user.role} para ${data.role}`)
    prisma.notification.create({
      data: {
        userId: id,
        title: 'Cargo atualizado',
        message: `Seu cargo foi atualizado para ${data.role}.`,
        type: 'SYSTEM',
        link: '/configuracoes',
      },
    }).catch(() => {})
  }
  if (data.position && data.position !== user.position) {
    changes.push(`função alterada para "${data.position}"`)
  }
  if (data.isActive !== undefined && data.isActive !== user.isActive) {
    changes.push(data.isActive ? 'reativado' : 'desativado')
    if (!data.isActive) {
      prisma.notification.create({
        data: {
          userId: id,
          title: 'Conta desativada',
          message: 'Sua conta foi desativada pela administração.',
          type: 'WARNING',
        },
      }).catch(() => {})
    }
  }

  if (changes.length > 0) {
    logAction(actorId, 'UPDATE_MEMBER', `Atualizou ${user.name}: ${changes.join('; ')}`, 'User', id, id, { changes })
  }

  return updated
}

export async function deleteTeamMember(id: string, companyId: string, actorId: string, actorName: string) {
  const user = await prisma.user.findFirst({ where: { id, companyId } })
  if (!user) return null
  await prisma.user.update({ where: { id }, data: { isActive: false } })
  prisma.notification.create({
    data: {
      userId: id,
      title: 'Conta desativada',
      message: `Sua conta foi desativada por ${actorName}.`,
      type: 'WARNING',
    },
  }).catch(() => {})
  logAction(actorId, 'DEACTIVATE_MEMBER', `${actorName} desativou ${user.name}`, 'User', id, id, { actorName })
  return { message: 'Colaborador desativado com sucesso' }
}

export async function hardDeleteTeamMember(id: string, companyId: string, actorId: string, actorName: string) {
  const user = await prisma.user.findFirst({ where: { id, companyId } })
  if (!user) return null
  await prisma.user.delete({ where: { id } })
  logAction(actorId, 'DELETE_MEMBER', `${actorName} removeu permanentemente ${user.name}`, 'User', id, id, { actorName })
  return { message: 'Colaborador removido permanentemente' }
}

export async function resetTeamMemberPassword(id: string, companyId: string, actorId: string, actorName: string) {
  const user = await prisma.user.findFirst({ where: { id, companyId } })
  if (!user) return null

  const tempPassword = generateCode() + 'Xy9'
  const hashed = await bcrypt.hash(tempPassword, 10)

  await prisma.user.update({
    where: { id },
    data: { password: hashed },
  })

  prisma.notification.create({
    data: {
      userId: id,
      title: 'Senha redefinida',
      message: `${actorName} redefiniu sua senha. Use a senha temporária fornecida pelo RH.`,
      type: 'SYSTEM',
      link: '/configuracoes',
    },
  }).catch(() => {})
  logAction(actorId, 'RESET_PASSWORD', `${actorName} redefiniu a senha de ${user.name}`, 'User', id, id, { actorName })

  return { tempPassword, message: 'Senha redefinida com sucesso' }
}

export async function resendVerification(id: string, companyId: string, actorId: string, actorName: string) {
  const user = await prisma.user.findFirst({ where: { id, companyId } })
  if (!user) return null
  if (user.emailVerified) {
    throw Object.assign(new Error('Email já verificado'), { statusCode: 400 })
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      user.email,
      { data: { name: user.name } }
    )
    if (error) {
      console.warn('[Team] Erro ao reenviar convite Supabase:', error.message)
    }
  } catch (err: any) {
    console.warn('[Team] Erro ao reenviar convite Supabase:', err?.message)
  }

  logAction(actorId, 'RESEND_VERIFICATION', `${actorName} reenviou verificação para ${user.name}`, 'User', id, id, { actorName })

  return { message: 'Convite de verificação reenviado com sucesso.' }
}

export async function getMetrics(companyId: string, actorId?: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const canAll = await canViewAll(actorId)
  const whereCompany = canAll ? {} : { companyId }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)

  const [total, active, inactive, verified, justifications, todayRecords, hiresThisMonth, deactivationsThisMonth, hiresPrevMonth, deactivationsPrevMonth] = await Promise.all([
    prisma.user.count({ where: whereCompany }),
    prisma.user.count({ where: { ...whereCompany, isActive: true } }),
    prisma.user.count({ where: { ...whereCompany, isActive: false } }),
    prisma.user.count({ where: { ...whereCompany, emailVerified: true } }),
    prisma.justification.count({
      where: { status: 'PENDING', user: canAll ? {} : { companyId } },
    }),
    prisma.timeRecord.findMany({
      where: { date: new Date(todayStr), user: canAll ? {} : { companyId } },
      select: { userId: true, status: true, clockIn: true, clockOut: true, totalMinutes: true },
    }),
    prisma.user.count({
      where: { ...whereCompany, hireDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.user.count({
      where: { ...whereCompany, isActive: false, updatedAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.user.count({
      where: { ...whereCompany, hireDate: { gte: prevMonthStart, lte: prevMonthEnd } },
    }),
    prisma.user.count({
      where: { ...whereCompany, isActive: false, updatedAt: { gte: prevMonthStart, lte: prevMonthEnd } },
    }),
  ])

  const presentToday = todayRecords.filter(r => r.clockIn).length
  const lateToday = todayRecords.filter(r => r.clockIn && r.status === 'ABSENCE').length
  const absentToday = active - presentToday

  function trend(current: number, prev: number): 'up' | 'down' | 'stable' {
    if (current > prev) return 'up'
    if (current < prev) return 'down'
    return 'stable'
  }

  return {
    total,
    active,
    inactive,
    verified,
    presentToday,
    lateToday,
    absentToday: Math.max(absentToday, 0),
    pendingJustifications: justifications,
    hiresThisMonth,
    deactivationsThisMonth,
    hiresTrend: trend(hiresThisMonth, hiresPrevMonth),
    deactivationsTrend: trend(deactivationsThisMonth, deactivationsPrevMonth),
  }
}

export async function getActivityLogs(companyId: string, limit = 20) {
  return prisma.activityLog.findMany({
    where: {
      OR: [
        { user: { companyId } },
        { targetUser: { companyId } },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, name: true, avatar: true, role: true } },
      targetUser: { select: { id: true, name: true, avatar: true } },
    },
  })
}

export async function getProfile(userId: string, companyId: string, actorId?: string) {
  const where = (await canViewAll(actorId)) ? { id: userId } : { id: userId, companyId }
  const user = await prisma.user.findFirst({
    where,
    include: {
      departmentRel: { select: { name: true } },
      positionRel: { select: { name: true } },
    },
  })
  if (!user) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const [monthRecords, todayRecord, justifications, logs, userCount] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, clockIn: true, clockOut: true, breakStart: true, breakEnd: true, totalMinutes: true, status: true, overtimeMinutes: true },
    }),
    prisma.timeRecord.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { clockIn: true, clockOut: true, breakStart: true, breakEnd: true, totalMinutes: true, status: true },
    }),
    prisma.justification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.activityLog.findMany({
      where: { targetUserId: userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
      },
    }),
    prisma.user.count({ where: { companyId, createdAt: { lt: user.createdAt } } }),
  ])

  const monthTotalMinutes = monthRecords.reduce((s, r) => s + calcMinutes(r), 0)
  const hireDay = user.hireDate ? new Date(user.hireDate) : undefined
  const workingDays = countWorkingDays(today.getFullYear(), today.getMonth() + 1, hireDay)
  const dailyHours = (user.weeklyHours || 40) / 5
  const expected = Math.round(workingDays * dailyHours * 60)
  const balanceHours = Math.round((monthTotalMinutes - expected) / 60 * 100) / 100

  const lateDays = monthRecords.filter(r => r.status === 'ABSENCE').length
  const absenceDays = monthRecords.filter(r => !r.clockIn).length
  const extraMinutes = monthRecords.reduce((s, r) => s + (r.overtimeMinutes || 0), 0)

  const firstAccess = user.createdAt
  const lastAccess = user.lastAccessAt

  const todayInfo = todayRecord ? {
    clockIn: todayRecord.clockIn,
    clockOut: todayRecord.clockOut,
    breakStart: todayRecord.breakStart,
    breakEnd: todayRecord.breakEnd,
    totalMinutes: todayRecord.totalMinutes,
    status: todayRecord.status,
  } : null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.departmentRel?.name || user.department || null,
    departmentId: user.departmentId,
    position: user.positionRel?.name || user.position || null,
    positionId: user.positionId,
    contractType: user.contractType,
    phone: user.phone,
    avatar: user.avatar,
    employeeCode: user.employeeCode,
    registrationNumber: user.registrationNumber,
    birthDate: user.birthDate,
    address: user.address,
    weeklyHours: user.weeklyHours,
    workSchedule: user.workSchedule,
    hireDate: user.hireDate,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    permissions: user.permissions,
    companyId: user.companyId,
    createdAt: user.createdAt,
    stats: {
      monthTotalMinutes,
      balanceHours,
      extraMinutes,
      lateDays,
      absenceDays,
      monthWorkedDays: monthRecords.filter(r => r.clockIn).length,
    },
    today: todayInfo,
    justifications,
    activityLogs: logs,
    firstAccess,
    lastAccess,
    memberCount: userCount + 1,
  }
}

export async function listTeamEnriched(companyId: string, actorId?: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const canAll = await canViewAll(actorId)
  const where = canAll ? {} : { companyId }

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, role: true, department: true,
      position: true, contractType: true, phone: true, avatar: true,
      employeeCode: true, registrationNumber: true, weeklyHours: true, workSchedule: true,
      hireDate: true, isActive: true, emailVerified: true, lastAccessAt: true,
      companyId: true,
    },
  })

  const userIds = users.map((u) => u.id)

  const [todayRecords, monthRecords, pendingJusts] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { userId: { in: userIds }, date: today },
      select: { userId: true, clockIn: true, clockOut: true, totalMinutes: true, status: true },
    }),
    prisma.timeRecord.findMany({
      where: { userId: { in: userIds }, date: { gte: monthStart, lte: monthEnd } },
      select: { userId: true, clockIn: true, clockOut: true, breakStart: true, breakEnd: true, totalMinutes: true },
    }),
    prisma.justification.findMany({
      where: { userId: { in: userIds }, status: 'PENDING' },
      select: { userId: true, id: true, reason: true, startDate: true, endDate: true },
    }),
  ])

  const todayMap = new Map(todayRecords.map((r) => [r.userId, r]))
  const pendingJustMap = new Map<string, typeof pendingJusts[0]>()
  for (const j of pendingJusts) {
    if (!pendingJustMap.has(j.userId)) pendingJustMap.set(j.userId, j)
  }

  const monthTotals = new Map<string, number>()
  for (const r of monthRecords) {
    const current = monthTotals.get(r.userId) || 0
    const mins = r.totalMinutes != null ? r.totalMinutes : calcMinutes(r)
    monthTotals.set(r.userId, current + mins)
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

  return users.map((u) => {
    const todayRec = todayMap.get(u.id)
    const monthTotal = monthTotals.get(u.id) || 0
    const hireDay = u.hireDate ? new Date(u.hireDate) : undefined
    const wd = countWorkingDays(today.getFullYear(), today.getMonth() + 1, hireDay)
    const dailyHours = (u.weeklyHours || 40) / 5
    const expected = Math.round(wd * dailyHours * 60)
    const balance = Math.round((monthTotal - expected) / 60 * 100) / 100
    const pending = pendingJustMap.get(u.id)
    const isOnline = u.lastAccessAt ? new Date(u.lastAccessAt) >= fiveMinAgo : false

    return {
      ...u,
      todayClockIn: todayRec?.clockIn || null,
      todayClockOut: todayRec?.clockOut || null,
      todayTotalMinutes: todayRec?.totalMinutes || null,
      todayStatus: todayRec?.status || null,
      monthTotalMinutes: monthTotal,
      balanceHours: balance,
      isOnline,
      pendingJustification: pending ? {
        id: pending.id,
        reason: pending.reason,
        startDate: pending.startDate,
        endDate: pending.endDate,
      } : null,
    }
  })
}


