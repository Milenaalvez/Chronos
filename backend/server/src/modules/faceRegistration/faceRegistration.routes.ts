import { Router } from 'express'
import * as controller from './faceRegistration.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const faceRegistrationRouter = Router()

faceRegistrationRouter.post('/register', authMiddleware, controller.register)
faceRegistrationRouter.get('/status', authMiddleware, controller.status)
faceRegistrationRouter.get('/descriptors', authMiddleware, controller.descriptors)
