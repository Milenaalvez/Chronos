import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './reference.service.js'

export async function departments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await service.listDepartments(req.user!.companyId)
    res.json(data)
  } catch (err) { next(err) }
}

export async function positions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const departmentId = req.query['departmentId'] as string | undefined
    const data = await service.listPositions(req.user!.companyId, departmentId)
    res.json(data)
  } catch (err) { next(err) }
}
