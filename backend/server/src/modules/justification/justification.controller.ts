import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './justification.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await service.listJustifications(req.user!.userId, req.user!.role, req.user!.companyId)
    res.json(items)
  } catch (err) { next(err) }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { reason, startDate, endDate } = req.body
    if (!reason || !startDate || !endDate) {
      res.status(400).json({ error: 'Motivo, data início e data fim são obrigatórios' })
      return
    }
    const just = await service.createJustification(req.user!.userId, req.body)
    res.status(201).json(just)
  } catch (err) { next(err) }
}

export async function approve(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const just = await service.approveJustification(req.params['id'] as string, req.user!.userId, req.user!.name || 'Administrador', req.user!.companyId)
    res.json(just)
  } catch (err) { next(err) }
}

export async function reject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rhResponse } = req.body
    const just = await service.rejectJustification(req.params['id'] as string, req.user!.userId, req.user!.name || 'Administrador', req.user!.companyId, rhResponse)
    res.json(just)
  } catch (err) { next(err) }
}
