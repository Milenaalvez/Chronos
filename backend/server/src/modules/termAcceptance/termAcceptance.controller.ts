import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './termAcceptance.service.js'

export async function accept(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ip = req.ip || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    const result = await service.acceptTerms(req.user!.userId, ip, userAgent)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function status(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.getStatus(req.user!.userId)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
