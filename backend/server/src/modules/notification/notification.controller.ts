import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth.js'
import * as service from './notification.service.js'

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const notifs = await service.listNotifications(req.user!.userId)
    res.json(notifs)
  } catch (err) { next(err) }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.markAsRead(req.params['id'], req.user!.userId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.markAllAsRead(req.user!.userId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const count = await service.unreadCount(req.user!.userId)
    res.json({ count })
  } catch (err) { next(err) }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.deleteNotification(req.params['id'], req.user!.userId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function refreshNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await service.generateAllSmartNotifications(req.user!.userId)
    const count = await service.unreadCount(req.user!.userId)
    res.json({ ok: true, count })
  } catch (err) { next(err) }
}
