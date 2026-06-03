import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './reports.service.js'

export async function getConsolidated(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const year = Number(req.query['year']) || new Date().getFullYear()
    const month = Number(req.query['month']) || (new Date().getMonth() + 1)
    const data = await service.getConsolidated(req.user!.companyId, {
      year,
      month,
      departmentId: req.query['departmentId'] as string | undefined,
      positionId: req.query['positionId'] as string | undefined,
      collaboratorId: req.query['collaboratorId'] as string | undefined,
      status: req.query['status'] as string | undefined,
    })
    res.json(data)
  } catch (err) { next(err) }
}

export async function getClosingStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const year = Number(req.query['year']) || new Date().getFullYear()
    const month = Number(req.query['month']) || (new Date().getMonth() + 1)
    const data = await service.getClosingStatus(req.user!.companyId, year, month)
    res.json(data)
  } catch (err) { next(err) }
}

export async function closeMonth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { year, month } = req.body
    if (!year || !month) { res.status(400).json({ error: 'year e month são obrigatórios' }); return }
    const result = await service.closeMonth(req.user!.companyId, year, month, req.user!.userId)
    res.json(result)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
}

export async function reopenMonth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { year, month } = req.body
    if (!year || !month) { res.status(400).json({ error: 'year e month são obrigatórios' }); return }
    const result = await service.reopenMonth(req.user!.companyId, year, month, req.user!.userId)
    res.json(result)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
}

export async function getAuditLog(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const year = Number(req.query['year']) || new Date().getFullYear()
    const month = Number(req.query['month']) || (new Date().getMonth() + 1)
    const data = await service.getAuditLog(req.user!.companyId, year, month)
    res.json(data)
  } catch (err) { next(err) }
}
