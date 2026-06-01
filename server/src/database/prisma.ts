import { PrismaClient } from '../../../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { env } from '../config/env.js'

const pool = new pg.Pool({ connectionString: env.databaseUrl })
const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({ adapter })
