import { Router } from 'express'
import * as controller from './companyConfig.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/roles.js'

export const companyConfigRouter = Router()
companyConfigRouter.use(authMiddleware)

companyConfigRouter.get('/', controller.get)
companyConfigRouter.get('/:companyId', controller.get)
companyConfigRouter.put('/', requireRole('SUPER_ADMIN', 'ADMIN'), controller.update)
companyConfigRouter.put('/:companyId', requireRole('SUPER_ADMIN', 'ADMIN'), controller.update)
