import type { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'
import { getEffectivePermissions, type Permission } from '../utils/permissions.js'

export function requirePermission(...required: Permission[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' })
      return
    }
    const { prisma } = await import('../database/prisma.js')
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { role: true, permissions: true, department: true },
      })
      if (!user) {
        res.status(401).json({ error: 'Usuário não encontrado' })
        return
      }
      if (user.role === 'SUPER_ADMIN') { next(); return }
      const perms = getEffectivePermissions(user.role, user.permissions as string[] | null, user.department)
      const hasAll = required.every((p) => perms.includes(p))
      if (!hasAll) {
        res.status(403).json({ error: 'Sem permissão para esta ação' })
        return
      }
      next()
    } catch {
      res.status(500).json({ error: 'Erro ao verificar permissões' })
    }
  }
}

export const canAccessTeam = requirePermission('access_team')
export const canManageMembers = requirePermission('manage_members')
export const canApproveJustifications = requirePermission('approve_justifications')
export const canEditTimeRecords = requirePermission('edit_time_records')
export const canApproveTimeRecords = requirePermission('approve_time_records')
export const canViewLogs = requirePermission('view_logs')
export const canSwitchAccounts = requirePermission('switch_accounts')
export const canManagePermissions = requirePermission('manage_permissions')
export const canManageTickets = requirePermission('manage_tickets')
