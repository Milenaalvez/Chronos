import { Router } from 'express'
import multer from 'multer'
import * as controller from './document.controller.js'
import { authMiddleware } from '../../middleware/auth.js'

export const documentRouter = Router()
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })

documentRouter.use(authMiddleware)

documentRouter.post('/upload', upload.single('file'), controller.upload)
documentRouter.get('/user/:userId', controller.list)
documentRouter.delete('/:id', controller.remove)
