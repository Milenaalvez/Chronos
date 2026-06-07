import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'
import dns from 'dns'
import { prisma } from './database/prisma.js'
import { env } from './config/env.js'

console.log('[Startup] CWD:', process.cwd())
console.log('[Startup] PORT:', env.port)
console.log('[Startup] SUPABASE_URL:', env.supabaseUrl ? 'configurada' : 'ausente')
console.log('[Startup] SUPABASE_SERVICE_ROLE_KEY:', env.supabaseServiceRoleKey ? 'configurada' : 'AUSENTE - emails não funcionarão')
console.log('[Startup] SMTP_HOST:', env.smtpHost || 'AUSENTE')
console.log('[Startup] SMTP_USER:', env.smtpUser || 'AUSENTE')
console.log('[Startup] SMTP_PASS:', env.smtpPass ? '****' : 'AUSENTE')
console.log('[Startup] SMTP_FROM:', env.smtpFrom || 'AUSENTE')
import { errorHandler } from './middleware/error.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { timeRecordRouter } from './modules/timeRecord/timeRecord.routes.js'
import { justificationRouter } from './modules/justification/justification.routes.js'
import { notificationRouter } from './modules/notification/notification.routes.js'
import { teamRouter } from './modules/team/team.routes.js'
import { documentRouter } from './modules/document/document.routes.js'
import { referenceRouter } from './modules/reference/reference.routes.js'
import { pointRecordRouter } from './modules/pointRecord/pointRecord.routes.js'
import { termAcceptanceRouter } from './modules/termAcceptance/termAcceptance.routes.js'
import { faceRegistrationRouter } from './modules/faceRegistration/faceRegistration.routes.js'
import { reportRouter } from './modules/reports/reports.routes.js'
import { companyRouter } from './modules/company/company.routes.js'
import { branchRouter } from './modules/branch/branch.routes.js'
import { companyConfigRouter } from './modules/companyConfig/companyConfig.routes.js'
import { ticketRouter } from './modules/ticket/ticket.routes.js'
import { startScheduler } from './utils/scheduler.js'

const app = express()

const allowedOrigins = env.corsOrigin.split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chronos-api', version: '1.0.0' })
})

app.get('/api/diagnostics/smtp', async (_req, res) => {
  const hasSmtp = !!(env.smtpHost && env.smtpUser && env.smtpPass)
  const result: any = {
    configured: hasSmtp,
    host: env.smtpHost || null,
    user: env.smtpUser || null,
    from: env.smtpFrom || null,
    ports: {},
  }

  if (!hasSmtp) {
    result.error = 'SMTP não configurado'
    return res.json(result)
  }

  // Resolve IPv4
  let ip = env.smtpHost
  try {
    const addrs = await dns.promises.resolve4(env.smtpHost)
    if (addrs.length > 0) ip = addrs[0]
    result.resolvedIp = ip
  } catch {
    result.ipv4Error = 'Falha ao resolver IPv4'
  }

  for (const port of [587, 465]) {
    const test: any = { port, secure: port === 465 }
    const transport = nodemailer.createTransport({
      host: ip,
      port,
      secure: port === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    })
    try {
      await transport.verify()
      test.ok = true
    } catch (err: any) {
      test.ok = false
      test.error = err.message?.split('\n')[0] || err.message
    }
    transport.close()
    result.ports[port] = test
  }

  res.json(result)
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
app.use('/api/reports', reportRouter)
app.use('/api/companies', companyRouter)
app.use('/api/branches', branchRouter)
app.use('/api/company-config', companyConfigRouter)
app.use('/api/tickets', ticketRouter)

app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Chronos API running on http://localhost:${env.port}`)
  startScheduler()
})
