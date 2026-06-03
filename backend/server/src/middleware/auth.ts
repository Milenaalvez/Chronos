import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'

export interface AuthPayload {
  userId: string
  role: string
  companyId: string
  branchId: string | null
  name: string
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

export async function generateRefreshToken(userId: string, rememberMe = false): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex')
  const hash = await bcrypt.hash(raw, 10)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 365 : 30))
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshTokenHash: hash,
      refreshTokenExpiresAt: expiresAt,
      refreshTokenVersion: { increment: 1 },
    },
  })
  return `${userId}.${raw}`
}

export async function consumeRefreshToken(token: string): Promise<{ userId: string } | null> {
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const userId = token.slice(0, dot)
  const raw = token.slice(dot + 1)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, refreshTokenHash: true, refreshTokenExpiresAt: true },
  })
  if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) return null
  if (new Date() > user.refreshTokenExpiresAt) return null
  const valid = await bcrypt.compare(raw, user.refreshTokenHash)
  if (!valid) return null
  return { userId }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret, { algorithms: ['HS256'] }) as AuthPayload
    req.user = payload
    // Track last activity (fire-and-forget, never block the request)
    prisma.user.update({
      where: { id: payload.userId },
      data: { lastAccessAt: new Date() },
    }).catch(() => {})
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return
  }
}
