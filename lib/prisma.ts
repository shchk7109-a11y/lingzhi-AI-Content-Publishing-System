import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db'
  // Ensure the URL has the file: prefix
  const normalizedUrl = dbUrl.startsWith('file:') ? dbUrl : `file:${dbUrl}`
  // Resolve relative paths to absolute
  const dbPath = normalizedUrl.replace('file:', '')
  const absoluteDbPath = path.isAbsolute(dbPath) 
    ? dbPath 
    : path.join(process.cwd(), dbPath)
  const absoluteUrl = `file:${absoluteDbPath}`
  
  // PrismaBetterSqlite3 v7 takes a config object with url property
  const adapter = new PrismaBetterSqlite3({ url: absoluteUrl })
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma =
  globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
