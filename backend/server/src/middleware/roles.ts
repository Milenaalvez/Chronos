import type { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' })
      return
    }
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'DEVELOPER' || roles.includes(req.user.role)) {
      next()
      return
    }
    res.status(403).json({ error: 'Sem permissão para esta ação' })
  }
}

export const adminOnly = requireRole('ADMIN')
export const rhOrAdmin = requireRole('RH', 'ADMIN')
