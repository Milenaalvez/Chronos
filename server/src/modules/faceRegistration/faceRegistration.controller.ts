import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './faceRegistration.service.js'

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { descriptors, images } = req.body
    if (!descriptors || !images) {
      res.status(400).json({ error: 'Descritores faciais e imagens são obrigatórios' })
      return
    }
    const result = await service.registerFace(req.user!.userId, descriptors, images)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function status(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.getRegistration(req.user!.userId)
    res.json({ registered: !!result, registration: result })
  } catch (err) {
    next(err)
  }
}

export async function descriptors(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await service.getDescriptors(req.user!.userId)
    res.json(result || { descriptors: null, status: null })
  } catch (err) {
    next(err)
  }
}
