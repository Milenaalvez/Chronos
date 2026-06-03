import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as configService from './companyConfig.service.js'

export async function get(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const companyId = (req.params.companyId as string) || req.user!.companyId
    const config = await configService.getConfig(companyId, req.user!.role, req.user!.companyId)
    res.json(config)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const companyId = (req.params.companyId as string) || req.user!.companyId
    const { logo, primaryColor, requireGeo, requireFace, defaultWeeklyHours, lunchDuration } = req.body
    const config = await configService.updateConfig(companyId, {
      logo, primaryColor, requireGeo, requireFace, defaultWeeklyHours, lunchDuration,
    }, req.user!.role, req.user!.companyId)
    res.json(config)
  } catch (err: any) {
    if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return }
    next(err)
  }
}
