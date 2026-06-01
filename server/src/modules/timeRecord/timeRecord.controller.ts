import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './timeRecord.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query as any
    const records = await service.listRecords(req.user!.userId, startDate, endDate)
    res.json(records)
  } catch (err) { next(err) }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const record = await service.getRecord(req.params['id'], req.user!.userId)
    if (!record) {
      res.status(404).json({ error: 'Registro não encontrado' })
      return
    }
    res.json(record)
  } catch (err) { next(err) }
}

export async function upsert(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { date, clockIn } = req.body
    if (!date || !clockIn) {
      res.status(400).json({ error: 'Data e entrada são obrigatórios' })
      return
    }
    const record = await service.upsertRecord(req.user!.userId, req.body)
    res.status(201).json(record)
  } catch (err) { next(err) }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ok = await service.deleteRecord(req.params['id'], req.user!.userId)
    if (!ok) {
      res.status(404).json({ error: 'Registro não encontrado' })
      return
    }
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function approve(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { note } = req.body
    const result = await service.approveRecord(req.params['id'], req.user!.userId, req.user!.companyId, note)
    if (!result) { res.status(404).json({ error: 'Registro não encontrado' }); return }
    res.json(result)
  } catch (err) { next(err) }
}

export async function reject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { note } = req.body
    const result = await service.rejectRecord(req.params['id'], req.user!.userId, req.user!.companyId, note)
    if (!result) { res.status(404).json({ error: 'Registro não encontrado' }); return }
    res.json(result)
  } catch (err) { next(err) }
}

export async function pendingReviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const records = await service.listPendingReviews(req.user!.companyId)
    res.json(records)
  } catch (err) { next(err) }
}
