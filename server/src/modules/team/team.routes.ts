import { Router } from 'express'
import * as controller from './team.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { adminOnly, rhOrAdmin } from '../../middleware/roles.js'
import { canAccessTeam, canManageMembers, canViewLogs, canManagePermissions } from '../../middleware/permissions.js'

export const teamRouter = Router()
teamRouter.use(authMiddleware)

teamRouter.get('/', canAccessTeam, controller.list)
teamRouter.get('/enriched', canAccessTeam, controller.listEnriched)
teamRouter.get('/metrics', canAccessTeam, controller.metrics)
teamRouter.get('/activity/logs', canViewLogs, controller.activityLogs)
teamRouter.get('/:id', canAccessTeam, controller.getById)
teamRouter.post('/', canManageMembers, controller.create)
teamRouter.put('/:id', canManageMembers, controller.update)
teamRouter.put('/:id/role', rhOrAdmin, controller.updateRole)
teamRouter.put('/:id/status', rhOrAdmin, controller.updateStatus)
teamRouter.delete('/:id', adminOnly, controller.remove)
teamRouter.put('/:id/deactivate', rhOrAdmin, controller.deactivate)
teamRouter.post('/:id/reset-password', rhOrAdmin, controller.resetPassword)
teamRouter.post('/:id/resend-verification', rhOrAdmin, controller.resendVerification)
teamRouter.get('/:id/profile', canAccessTeam, controller.getProfile)
teamRouter.get('/:id/permissions', canManagePermissions, controller.getPermissions)
teamRouter.put('/:id/permissions', canManagePermissions, controller.updatePermissions)
