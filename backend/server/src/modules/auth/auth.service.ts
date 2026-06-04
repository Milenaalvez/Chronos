import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../../database/prisma.js'
import { supabaseAdmin } from '../../database/supabase.js'
import { generateToken, generateRefreshToken, consumeRefreshToken } from '../../middleware/auth.js'
import { validateCPF, stripCPF } from '../../utils/cpf.js'
import { validatePassword } from '../../utils/password.js'
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSecurityNotification,
} from '../../services/email.js'
import { env } from '../../config/env.js'
import { createNotification } from '../notification/notification.service.js'

function logActivity(userId: string, action: string, description: string, entityType: string, entityId: string, targetUserId?: string, metadata?: any) {
  return prisma.activityLog.create({
    data: { userId, action, description, entityType, entityId, targetUserId, metadata: metadata || {} },
  }).catch(() => {})
}

function generateTokenHex(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function generateRegistrationNumber(): Promise<string> {
  const last = await prisma.user.findFirst({
    where: { registrationNumber: { not: null } },
    orderBy: { registrationNumber: 'desc' },
    select: { registrationNumber: true },
  })
  const nextNum = last?.registrationNumber ? Number(last.registrationNumber) + 1 : 10001
  return String(nextNum)
}

async function loginResponse(user: { id: string; role: string; companyId: string; branchId: string | null; name: string }, rememberMe = false) {
  const token = generateToken({ userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId ?? null, name: user.name })
  const refreshToken = await generateRefreshToken(user.id, rememberMe)
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } })
  return { token, refreshToken, user: sanitizeUser(fullUser!) }
}

export async function registerUser(data: {
  name: string
  email: string
  password: string
  cpf?: string
  phone?: string
  position?: string
  companySlug?: string
}) {
  const nameTrimmed = data.name.trim()
  const emailLower = data.email.toLowerCase().trim()

  if (!nameTrimmed || nameTrimmed.length < 2) {
    throw Object.assign(new Error('Nome deve ter pelo menos 2 caracteres'), { statusCode: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    throw Object.assign(new Error('Formato de email inválido'), { statusCode: 400 })
  }

  const passwordCheck = validatePassword(data.password)
  if (!passwordCheck.valid) {
    throw Object.assign(new Error(passwordCheck.message), { statusCode: 400 })
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: emailLower } })
  if (existingEmail) {
    throw Object.assign(new Error('Este email já possui cadastro'), { statusCode: 409 })
  }

  let cpfCleaned: string | undefined
  if (data.cpf) {
    cpfCleaned = stripCPF(data.cpf)
    if (!validateCPF(cpfCleaned)) {
      throw Object.assign(new Error('CPF inválido'), { statusCode: 400 })
    }
    const existingCpf = await prisma.user.findUnique({ where: { cpf: cpfCleaned } })
    if (existingCpf) {
      throw Object.assign(new Error('CPF já cadastrado'), { statusCode: 409 })
    }
  }

  let company = await prisma.company.findUnique({ where: { slug: data.companySlug || 'default' } })
  let isNewCompany = false
  if (!company) {
    company = await prisma.company.create({
      data: { name: data.companySlug || 'Default Company', slug: data.companySlug || 'default' },
    })
    isNewCompany = true
  }

  const hashed = await bcrypt.hash(data.password, 10)

  const userCount = await prisma.user.count({ where: { companyId: company.id } })
  const role = userCount === 0 || isNewCompany ? 'DEVELOPER' : 'EMPLOYEE'

  const registrationNumber = await generateRegistrationNumber()
  const verificationCode = generateTokenHex()
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const user = await prisma.user.create({
    data: {
      name: nameTrimmed,
      email: emailLower,
      password: hashed,
      cpf: cpfCleaned,
      phone: data.phone || null,
      position: data.position || null,
      companyId: company.id,
      registrationNumber,
      emailVerified: false,
      verificationCode,
      verificationExpiresAt,
      role,
    },
  })

  logActivity(user.id, 'ACCOUNT_CREATED', `Conta criada para ${nameTrimmed}`, 'User', user.id, user.id, {
    registrationNumber,
    companyId: company.id,
  })

  sendWelcomeEmail(
    emailLower,
    nameTrimmed,
    registrationNumber,
    data.position || role,
    company.name,
    `${env.appUrl}/?action=verify-email&token=${verificationCode}`
  ).catch((err: any) => console.error('[Auth] Erro ao enviar welcome email:', err?.message))

  createNotification(user.id, {
    title: 'Bem-vindo ao Chronos',
    message: 'Sua conta foi criada com sucesso. Seus registros de jornada começarão a ser contabilizados a partir da sua data de admissão.',
    type: 'INFO',
  }).catch(() => {})

  try {
    await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: nameTrimmed },
    })
  } catch (err: any) {
    console.warn('[Auth] Erro ao criar usuário no Supabase Auth (não crítico):', err?.message)
  }

  const token = generateToken({ userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId ?? null, name: user.name })
  const refreshTok = await generateRefreshToken(user.id, false)

  return {
    token,
    refreshToken: refreshTok,
    user: sanitizeUser(user),
    registrationNumber,
    message: 'Conta criada com sucesso! Verifique seu e-mail para ativar sua conta.'
  }
}

export async function sendVerificationCode(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (!user) {
    throw Object.assign(new Error('Email não encontrado'), { statusCode: 404 })
  }
  if (user.emailVerified) {
    throw Object.assign(new Error('Email já verificado'), { statusCode: 400 })
  }

  const verificationCode = generateTokenHex()
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode, verificationExpiresAt },
  })

  sendVerificationEmail(
    user.email,
    user.name,
    `${env.appUrl}/?action=verify-email&token=${verificationCode}`
  ).catch((err: any) => console.error('[Auth] Erro ao enviar verification email:', err?.message))

  logActivity(user.id, 'VERIFICATION_RESENT', `Novo link de verificação enviado para ${user.email}`, 'User', user.id, user.id)

  return { message: 'Email de verificação reenviado. Verifique sua caixa de entrada.' }
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: { verificationCode: token, verificationExpiresAt: { gte: new Date() } },
  })
  if (!user) {
    throw Object.assign(new Error('Token de verificação inválido ou expirado'), { statusCode: 400 })
  }
  if (user.emailVerified) {
    const tok = generateToken({ userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId ?? null, name: user.name })
    return { token: tok, user: sanitizeUser(user), message: 'Email já estava verificado.' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationCode: null,
      verificationExpiresAt: null,
      lastAccessAt: new Date(),
    },
  })

  logActivity(user.id, 'EMAIL_VERIFIED', `Email ${user.email} verificado com sucesso`, 'User', user.id, user.id)

  const tok = generateToken({ userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId ?? null, name: user.name })
  return { token: tok, user: sanitizeUser(user), message: 'Email verificado com sucesso' }
}

export async function loginUser(login: string, password: string, rememberMe = false) {
  const isEmail = login.includes('@')
  let user: any

  if (isEmail) {
    user = await prisma.user.findUnique({ where: { email: login.toLowerCase().trim() } })
  } else {
    const cleaned = login.trim().replace(/^(CHR|#)/i, '')
    user = await prisma.user.findUnique({ where: { registrationNumber: cleaned } })
  }

  if (!user) {
    throw Object.assign(new Error('Email ou senha incorretos'), { statusCode: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw Object.assign(new Error('Email ou senha incorretos'), { statusCode: 401 })
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Conta desativada. Entre em contato com o RH.'), { statusCode: 403 })
  }

  migrateUserToSupabase(user.email, password, user.name).catch(() => {})

  await prisma.user.update({ where: { id: user.id }, data: { lastAccessAt: new Date() } })
  return loginResponse(user, rememberMe)
}

async function migrateUserToSupabase(email: string, password: string, name: string) {
  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const exists = users?.users?.some(u => u.email === email.toLowerCase())
    if (exists) return
    await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    console.log('[Auth] Usuário migrado para Supabase Auth:', email)
  } catch (err: any) {
    console.warn('[Auth] Erro ao migrar usuário para Supabase Auth:', err?.message)
  }
}

export async function loginWithSupabase(accessToken: string) {
  const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !authUser?.email) {
    throw Object.assign(new Error('Sessão inválida'), { statusCode: 401 })
  }

  const emailLower = authUser.email.toLowerCase()

  let user = await prisma.user.findUnique({ where: { email: emailLower } })
  if (!user) {
    let company = await prisma.company.findUnique({ where: { slug: 'default' } })
    let isNewCompany = false
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'Default Company', slug: 'default' },
      })
      isNewCompany = true
    }

    const userCount = await prisma.user.count({ where: { companyId: company.id } })
    const role = userCount === 0 || isNewCompany ? 'DEVELOPER' : 'EMPLOYEE'

    const registrationNumber = await generateRegistrationNumber()

    user = await prisma.user.create({
      data: {
        name: authUser.user_metadata?.name || emailLower.split('@')[0],
        email: emailLower,
        password: '',
        avatar: authUser.user_metadata?.avatar_url || null,
        registrationNumber,
        emailVerified: authUser.email_confirmed_at ? true : false,
        companyId: company.id,
        role: role as any,
      },
    })
  } else {
    if (authUser.email_confirmed_at && !user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      })
    }
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Conta desativada. Entre em contato com o RH.'), { statusCode: 403 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastAccessAt: new Date() } })
  return loginResponse(user, false)
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (!user) {
    throw Object.assign(new Error('Email não encontrado'), { statusCode: 404 })
  }

  const resetToken = generateTokenHex()
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordCode: resetToken,
      resetPasswordExpiresAt: resetExpires,
    },
  })

  sendPasswordResetEmail(
    user.email,
    user.name,
    `${env.appUrl}/?action=reset-password&token=${resetToken}`
  ).catch((err: any) => console.error('[Auth] Erro ao enviar reset password email:', err?.message))

  logActivity(user.id, 'PASSWORD_RESET_REQUESTED', `Recuperação de senha solicitada para ${user.email}`, 'User', user.id, user.id)

  return { message: 'Enviamos um link de recuperação para seu email.' }
}

export async function updatePassword(token: string, newPassword: string) {
  const passwordCheck = validatePassword(newPassword)
  if (!passwordCheck.valid) {
    throw Object.assign(new Error(passwordCheck.message), { statusCode: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { resetPasswordCode: token, resetPasswordExpiresAt: { gte: new Date() } },
  })
  if (!user) {
    throw Object.assign(new Error('Token de recuperação inválido ou expirado'), { statusCode: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetPasswordCode: null,
      resetPasswordExpiresAt: null,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
      refreshTokenVersion: { increment: 1 },
    },
  })

  sendSecurityNotification(user.email, user.name).catch(() => {})

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'SECURITY',
      title: 'Senha alterada',
      message: 'Sua senha foi atualizada com sucesso.',
    },
  }).catch(() => {})

  logActivity(user.id, 'PASSWORD_CHANGED', `Senha alterada para ${user.email}`, 'User', user.id, user.id, {
    method: 'reset_token',
  })

  const tok = generateToken({ userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId ?? null, name: user.name })
  return { token: tok, user: sanitizeUser(user), message: 'Senha atualizada com sucesso' }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 })
  }
  return sanitizeUser(user)
}

export async function updateOwnProfile(userId: string, data: { name?: string; position?: string; phone?: string | null; email?: string; birthDate?: string | null; address?: string | null }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 })
  }
  const birthDate = data.birthDate ? new Date(data.birthDate) : data.birthDate === null ? null : undefined
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.position !== undefined ? { position: data.position || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.email ? { email: data.email.trim() } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
    },
  })
  return sanitizeUser(updated)
}

export async function googleAuth(data: {
  email: string
  name: string
  avatar?: string
}) {
  const emailLower = data.email.toLowerCase().trim()

  let user = await prisma.user.findUnique({ where: { email: emailLower } })

  if (user) {
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, lastAccessAt: new Date() },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastAccessAt: new Date() },
      })
    }
  } else {
    let company = await prisma.company.findUnique({ where: { slug: 'default' } })
    let isNewCompany = false
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'Default Company', slug: 'default' },
      })
      isNewCompany = true
    }

    const userCount = await prisma.user.count({ where: { companyId: company.id } })
    const role = userCount === 0 || isNewCompany ? 'DEVELOPER' : 'EMPLOYEE'

    const registrationNumber = await generateRegistrationNumber()

    user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: emailLower,
        password: '',
        avatar: data.avatar || null,
        registrationNumber,
        emailVerified: true,
        companyId: company.id,
        role,
      },
    })
  }

  return loginResponse(user, false)
}

function sanitizeUser(user: {
  id: string
  name: string
  email: string
  role: string
  cpf: string | null
  phone: string | null
  avatar: string | null
  department: string | null
  position: string | null
  contractType: string | null
  employeeCode: string | null
  registrationNumber: string | null
  companyId: string
  emailVerified: boolean
  hireDate: Date
  themeMode?: string
  themeAccent?: string
  permissions?: any
  weeklyHours?: number
}) {
  const hireDateStr = user.hireDate instanceof Date
    ? user.hireDate.toISOString().split('T')[0]
    : String(user.hireDate).substring(0, 10)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    cpf: user.cpf,
    phone: user.phone,
    avatar: user.avatar,
    department: user.department,
    position: user.position,
    contractType: user.contractType,
    employeeCode: user.employeeCode,
    registrationNumber: user.registrationNumber,
    companyId: user.companyId,
    emailVerified: user.emailVerified,
    hireDate: hireDateStr,
    themeMode: user.themeMode || "system",
    themeAccent: user.themeAccent || "blue",
    permissions: user.permissions || [],
    weeklyHours: user.weeklyHours ?? 40,
  }
}

export async function updatePreferences(userId: string, data: { themeMode?: string; themeAccent?: string }) {
  const updateData: Record<string, string> = {}
  if (data.themeMode) updateData.themeMode = data.themeMode
  if (data.themeAccent) updateData.themeAccent = data.themeAccent

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })
  return sanitizeUser(user)
}

export async function impersonateUser(actor: { userId: string; role: string; companyId: string; name: string }, targetUserId: string) {
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, isActive: true },
  })
  if (!target) {
    throw Object.assign(new Error('Usuário alvo não encontrado ou inativo'), { statusCode: 404 })
  }

  const { getEffectivePermissions } = await import('../../utils/permissions.js')
  const actorUser = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, permissions: true },
  })
  if (!actorUser) {
    throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 })
  }

  const perms = getEffectivePermissions(actorUser.role, actorUser.permissions as string[] | null)
  if (!perms.includes('switch_accounts')) {
    throw Object.assign(new Error('Sem permissão para trocar de conta'), { statusCode: 403 })
  }

  const token = generateToken({ userId: target.id, role: target.role, companyId: target.companyId, branchId: target.branchId ?? null, name: target.name })

  logActivity(actor.userId, 'IMPERSONATE', `${actor.name} acessou o perfil de ${target.name}`, 'User', target.id, target.id, {
    actorName: actor.name, targetName: target.name,
  })

  return loginResponse(target, false).then(r => ({ ...r, message: `Acessando como ${target.name}` }))
}

export async function getAccessibleAccounts(actor: { userId: string; role: string; companyId: string; name: string }) {
  const { getEffectivePermissions } = await import('../../utils/permissions.js')
  const actorUser = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, permissions: true },
  })
  if (!actorUser) return []

  const perms = getEffectivePermissions(actorUser.role, actorUser.permissions as string[] | null)
  if (!perms.includes('switch_accounts') && !perms.includes('access_profiles')) {
    return []
  }

  const accounts = await prisma.user.findMany({
    where: {
      isActive: true,
      company: { slug: { not: 'default' } },
    },
    select: {
      id: true, name: true, email: true, role: true, avatar: true,
      department: true, position: true,
    },
    orderBy: { name: 'asc' },
  })

  return accounts
}

export async function refreshSession(refreshToken: string) {
  const result = await consumeRefreshToken(refreshToken)
  if (!result) {
    throw Object.assign(new Error('Sessão expirada. Faça login novamente.'), { statusCode: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: result.userId } })
  if (!user || !user.isActive) {
    throw Object.assign(new Error('Usuário não encontrado ou inativo'), { statusCode: 401 })
  }
  return loginResponse(user, false)
}

export async function logoutUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
  })
}
