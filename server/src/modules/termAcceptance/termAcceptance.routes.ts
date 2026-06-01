import { Router } from 'express'
import * as controller from './termAcceptance.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const termAcceptanceRouter = Router()

termAcceptanceRouter.post('/accept', authMiddleware, controller.accept)
termAcceptanceRouter.get('/status', authMiddleware, controller.status)
