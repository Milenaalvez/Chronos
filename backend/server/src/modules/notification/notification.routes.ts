import { Router } from 'express'
import * as controller from './notification.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const notificationRouter = Router()
notificationRouter.use(authMiddleware)

notificationRouter.get('/', controller.list)
notificationRouter.put('/read-all', controller.markAllRead)
notificationRouter.get('/unread-count', controller.getUnreadCount)
notificationRouter.put('/:id/read', controller.markRead)
notificationRouter.delete('/:id', controller.remove)
notificationRouter.post('/', controller.create)
notificationRouter.post('/refresh', controller.refreshNotifications)
