import { Router } from 'express'
import * as controller from './company.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/roles.js'

export const companyRouter = Router()
companyRouter.use(authMiddleware)

companyRouter.get('/', requireRole('SUPER_ADMIN', 'ADMIN'), controller.list)
companyRouter.get('/:id', controller.getById)
companyRouter.post('/', requireRole('SUPER_ADMIN'), controller.create)
companyRouter.put('/:id', controller.update)
companyRouter.delete('/:id', requireRole('SUPER_ADMIN'), controller.remove)
