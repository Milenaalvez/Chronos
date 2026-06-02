import { Router } from 'express'
import * as controller from './reference.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const referenceRouter = Router()
referenceRouter.use(authMiddleware)

referenceRouter.get('/departments', controller.departments)
referenceRouter.get('/positions', controller.positions)
