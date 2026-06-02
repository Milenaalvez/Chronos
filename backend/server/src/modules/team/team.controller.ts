import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './team.service.js'
import { prisma } from '../../database/prisma.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await service.listTeam(req.user!.companyId, req.user!.userId)
    res.json(team)
  } catch (err) { next(err) }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const member = await service.getTeamMember(req.params['id'], req.user!.companyId, req.user!.userId)
    if (!member) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(member)
  } catch (err) { next(err) }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.createTeamMember(req.user!.companyId, req.body)
    prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE_MEMBER',
        description: `${req.user!.name || 'Administrador'} criou ${req.body.name}`,
        entityType: 'User',
        entityId: result.user.id,
        targetUserId: result.user.id,
        metadata: { actorName: req.user!.name || 'Administrador' },
      },
    }).catch(() => {})
    res.status(201).json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.updateTeamMember(req.params['id'], req.user!.companyId, req.user!.userId, req.body)
    if (!result) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(result)
  } catch (err) { next(err) }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.hardDeleteTeamMember(req.params['id'], req.user!.companyId, req.user!.userId, req.user!.name || 'Administrador')
    if (!result) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(result)
  } catch (err) { next(err) }
}

export async function deactivate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteTeamMember(req.params['id'], req.user!.companyId, req.user!.userId, req.user!.name || 'Administrador')
    if (!result) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(result)
  } catch (err) { next(err) }
}

export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.resetTeamMemberPassword(req.params['id'], req.user!.companyId, req.user!.userId, req.user!.name || 'Administrador')
    if (!result) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(result)
  } catch (err) { next(err) }
}

export async function resendVerification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.resendVerification(req.params['id'], req.user!.companyId, req.user!.userId, req.user!.name || 'Administrador')
    if (!result) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(result)
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message })
      return
    }
    next(err)
  }
}

export async function metrics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await service.getMetrics(req.user!.companyId, req.user!.userId)
    res.json(data)
  } catch (err) { next(err) }
}

export async function listEnriched(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await service.listTeamEnriched(req.user!.companyId, req.user!.userId)
    res.json(data)
  } catch (err) { next(err) }
}

export async function activityLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = Number(req.query['limit']) || 20
    const logs = await service.getActivityLogs(req.user!.companyId, limit)
    res.json(logs)
  } catch (err) { next(err) }
}

export async function updateRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { role } = req.body
    if (!role) { res.status(400).json({ error: 'Role é obrigatório' }); return }
    const result = await service.updateTeamMember(req.params['id'], req.user!.companyId, req.user!.userId, { role })
    if (!result) { res.status(404).json({ error: 'Membro não encontrado' }); return }
    res.json(result)
  } catch (err) { next(err) }
}

export async function updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { isActive } = req.body
    if (isActive === undefined) { res.status(400).json({ error: 'isActive é obrigatório' }); return }
    const result = await service.updateTeamMember(req.params['id'], req.user!.companyId, req.user!.userId, { isActive })
    if (!result) { res.status(404).json({ error: 'Membro não encontrado' }); return }
    res.json(result)
  } catch (err) { next(err) }
}

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await service.getProfile(req.params['id'], req.user!.companyId, req.user!.userId)
    if (!profile) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    res.json(profile)
  } catch (err) { next(err) }
}

export async function getPermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params['id'], companyId: req.user!.companyId },
      select: { id: true, role: true, permissions: true },
    })
    if (!user) { res.status(404).json({ error: 'Membro não encontrado' }); return }
    res.json(user)
  } catch (err) { next(err) }
}

export async function updatePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { permissions } = req.body
    if (!Array.isArray(permissions)) { res.status(400).json({ error: 'permissions deve ser um array' }); return }
    const user = await prisma.user.findFirst({
      where: { id: req.params['id'], companyId: req.user!.companyId },
    })
    if (!user) { res.status(404).json({ error: 'Membro não encontrado' }); return }
    const updated = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { permissions },
    })
    prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE_PERMISSIONS',
        description: `${req.user!.name} atualizou permissões de ${user.name}`,
        entityType: 'User',
        entityId: user.id,
        targetUserId: user.id,
        oldValue: JSON.stringify(user.permissions),
        newValue: JSON.stringify(permissions),
        metadata: { actorName: req.user!.name, targetName: user.name },
      },
    }).catch(() => {})
    res.json({ id: updated.id, permissions: updated.permissions })
  } catch (err) { next(err) }
}
