import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import { listPointRecords, createPointRecord } from './pointRecord.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const includePhoto = req.query.includePhoto === 'true'
    const userId = req.query.userId as string | undefined
    // Managers can query by userId; employees only see their own
    const targetUserId = (userId && (req.user!.role === 'RH' || req.user!.role === 'ADMIN'))
      ? userId
      : req.user!.userId
    const events = await listPointRecords(targetUserId, req.user!.companyId, req.query.date as string | undefined, includePhoto)
    res.json(events)
  } catch (err) { next(err) }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pointType, timeValue, latitude, longitude, locationAccuracy, locationAddress, locationCity, locationState, deviceInfo, photoData, hasPhoto, password, faceVerified } = req.body
    if (!pointType || !timeValue) {
      res.status(400).json({ error: 'pointType e timeValue são obrigatórios' })
      return
    }
    if (!['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'].includes(pointType)) {
      res.status(400).json({ error: 'Tipo de ponto inválido' })
      return
    }
    const event = await createPointRecord(req.user!.userId, {
      pointType,
      timeValue,
      latitude,
      longitude,
      locationAccuracy,
      locationAddress,
      locationCity,
      locationState,
      deviceInfo: { ...(deviceInfo || {}), ip: req.ip || req.socket.remoteAddress || 'unknown' },
      photoData,
      hasPhoto,
      password,
      faceVerified,
    })
    res.status(201).json(event)
  } catch (err) { next(err) }
}
