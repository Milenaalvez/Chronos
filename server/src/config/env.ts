import 'dotenv/config'

export const env = {
  port: Number(process.env['PORT']) || 3001,
  databaseUrl: process.env['DATABASE_URL'] || '',
  jwtSecret: process.env['JWT_SECRET'] || (() => { throw new Error('JWT_SECRET must be set in environment') })(),
  jwtExpiresIn: '7d',
  corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',
  supabaseUrl: process.env['SUPABASE_URL'] || '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] || '',
  supabaseServiceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',

  smtpHost: process.env['SMTP_HOST'] || '',
  smtpPort: Number(process.env['SMTP_PORT']) || 587,
  smtpUser: process.env['SMTP_USER'] || '',
  smtpPass: process.env['SMTP_PASS'] || '',
  smtpFrom: process.env['SMTP_FROM'] || 'noreply@chronos.app',
  appUrl: process.env['APP_URL'] || 'http://localhost:5173',
}
