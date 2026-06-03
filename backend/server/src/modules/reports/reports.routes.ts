import { Router } from 'express'
import * as controller from './reports.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permissions.js'
import { requireRole } from '../../middleware/roles.js'

export const reportRouter = Router()
reportRouter.use(authMiddleware)

reportRouter.get('/consolidated', requirePermission('export_reports'), controller.getConsolidated)
reportRouter.get('/closing-status', requirePermission('export_reports'), controller.getClosingStatus)
reportRouter.post('/close', requireRole('RH', 'ADMIN'), controller.closeMonth)
reportRouter.post('/reopen', requireRole('DEVELOPER'), controller.reopenMonth)
reportRouter.get('/audit-log', requirePermission('export_reports'), controller.getAuditLog)
