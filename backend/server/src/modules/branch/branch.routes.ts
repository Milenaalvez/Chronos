import { Router } from 'express'
import * as controller from './branch.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const branchRouter = Router()
branchRouter.use(authMiddleware)

branchRouter.get('/', controller.list)
branchRouter.get('/:id', controller.getById)
branchRouter.post('/', controller.create)
branchRouter.put('/:id', controller.update)
branchRouter.delete('/:id', controller.remove)
