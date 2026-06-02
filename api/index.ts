import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { env } from '../server/src/config/env.js'
import { errorHandler } from '../server/src/middleware/error.js'
import { authRouter } from '../server/src/modules/auth/auth.routes.js'
import { timeRecordRouter } from '../server/src/modules/timeRecord/timeRecord.routes.js'
import { justificationRouter } from '../server/src/modules/justification/justification.routes.js'
import { notificationRouter } from '../server/src/modules/notification/notification.routes.js'
import { teamRouter } from '../server/src/modules/team/team.routes.js'
import { documentRouter } from '../server/src/modules/document/document.routes.js'
import { referenceRouter } from '../server/src/modules/reference/reference.routes.js'
import { pointRecordRouter } from '../server/src/modules/pointRecord/pointRecord.routes.js'
import { termAcceptanceRouter } from '../server/src/modules/termAcceptance/termAcceptance.routes.js'
import { faceRegistrationRouter } from '../server/src/modules/faceRegistration/faceRegistration.routes.js'

const app = express()

app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chronos-api', version: '1.0.0' })
})

app.use('/api/auth', authRouter)
app.use('/api/time-records', timeRecordRouter)
app.use('/api/justifications', justificationRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/team', teamRouter)
app.use('/api/reference', referenceRouter)
app.use('/api/documents', documentRouter)
app.use('/api/point-records', pointRecordRouter)
app.use('/api/term-acceptance', termAcceptanceRouter)
app.use('/api/face-registration', faceRegistrationRouter)

app.use(errorHandler)

export default app
