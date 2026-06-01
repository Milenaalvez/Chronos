import { Router } from 'express'
import multer from 'multer'
import * as controller from './auth.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const authRouter = Router()
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } })

authRouter.post('/register', controller.register)
authRouter.post('/send-verification', controller.sendVerification)
authRouter.post('/verify-email', controller.verifyEmail)
authRouter.post('/login', controller.login)
authRouter.post('/login/supabase', controller.loginSupabase)
authRouter.post('/forgot-password', controller.forgotPassword)
authRouter.post('/update-password', controller.updatePassword)
authRouter.post('/google', controller.google)
authRouter.get('/me', authMiddleware, controller.me)
authRouter.put('/preferences', authMiddleware, controller.updatePreferences)
authRouter.put('/profile', authMiddleware, controller.updateProfile)
authRouter.post('/avatar', authMiddleware, upload.single('avatar'), controller.uploadAvatar)
authRouter.post('/impersonate', authMiddleware, controller.impersonate)
authRouter.get('/accessible-accounts', authMiddleware, controller.accessibleAccounts)
authRouter.post('/refresh', controller.refresh)
authRouter.post('/logout', authMiddleware, controller.logout)
