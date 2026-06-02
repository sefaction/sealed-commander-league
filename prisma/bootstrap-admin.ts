import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hash, role: UserRole.ADMIN, displayName: 'Administrator', isActive: true, forcePasswordChange: true },
    create: { username, passwordHash: hash, role: UserRole.ADMIN, displayName: 'Administrator', isActive: true, forcePasswordChange: true },
  });

  console.log(`[bootstrap-admin] ensured admin user: ${username}`);
}

main().finally(async () => prisma.$disconnect());
