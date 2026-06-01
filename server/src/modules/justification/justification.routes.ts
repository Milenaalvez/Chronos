import { Router } from 'express'
import * as controller from './justification.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { rhOrAdmin } from '../../middleware/roles.js'

export const justificationRouter = Router()
justificationRouter.use(authMiddleware)

justificationRouter.get('/', controller.list)
justificationRouter.post('/', controller.create)
justificationRouter.put('/:id/approve', rhOrAdmin, controller.approve)
justificationRouter.put('/:id/reject', rhOrAdmin, controller.reject)
