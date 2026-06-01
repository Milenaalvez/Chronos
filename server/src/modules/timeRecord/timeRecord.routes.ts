import { Router } from 'express'
import * as controller from './timeRecord.controller.js'
import { authMiddleware } from '../../middleware/auth.js'
import { canApproveTimeRecords } from '../../middleware/permissions.js'

export const timeRecordRouter = Router()
timeRecordRouter.use(authMiddleware)

timeRecordRouter.get('/', controller.list)
timeRecordRouter.get('/pending-reviews', canApproveTimeRecords, controller.pendingReviews)
timeRecordRouter.get('/:id', controller.getById)
timeRecordRouter.post('/', controller.upsert)
timeRecordRouter.delete('/:id', controller.remove)
timeRecordRouter.put('/:id/approve', canApproveTimeRecords, controller.approve)
timeRecordRouter.put('/:id/reject', canApproveTimeRecords, controller.reject)
