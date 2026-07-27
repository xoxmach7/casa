import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('broker123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'broker@casa.kz' },
    update: { password: hash },
    create: {
      email: 'broker@casa.kz',
      password: hash,
      firstName: 'Брокер',
      lastName: 'Тестовый',
      role: 'BROKER',
      phone: '+77771234567',
    },
  });

  console.log('Broker created:', user.id, user.email, user.role);
  await prisma.$disconnect();
}

main().catch(console.error);
