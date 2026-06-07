import { Router } from 'express'
import multer from 'multer'
import * as controller from './ticket.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { canManageTickets } from '../../middleware/permissions.js'

export const ticketRouter = Router()
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })

ticketRouter.use(authMiddleware)

ticketRouter.get('/', controller.list)
ticketRouter.get('/:id', controller.getById)
ticketRouter.post('/', upload.single('file'), controller.create)
ticketRouter.post('/:id/messages', upload.single('file'), controller.addMessage)
ticketRouter.put('/:id/status', canManageTickets, controller.updateStatus)
