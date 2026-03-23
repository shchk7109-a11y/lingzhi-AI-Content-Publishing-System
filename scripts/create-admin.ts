import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // List existing users
  const users = await prisma.user.findMany()
  console.log('Existing users:', JSON.stringify(users.map(u => ({ id: u.id, username: u.username, role: u.role, status: u.status })), null, 2))
  
  // Create admin if none exists
  const adminExists = users.some(u => u.role === 'ADMIN' && u.status === 'ACTIVE')
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hash,
        role: 'ADMIN',
        status: 'ACTIVE',
      }
    })
    console.log('Created admin user:', admin.username)
  } else {
    console.log('Admin user already exists')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
