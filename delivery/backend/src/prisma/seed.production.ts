import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting PRODUCTION seed (Clean & Admin only)...');

  // 1. Clean up database (Delete everything)
  // Deleting in correct order to avoid foreign key constraints
  await prisma.booking.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.courseProgress.deleteMany();
  await prisma.clientDocument.deleteMany();
  await prisma.mortgageCalculation.deleteMany();

  await prisma.property.deleteMany();
  await prisma.payment.deleteMany();

  await prisma.client.deleteMany(); // Clients depend on brokers
  await prisma.apartment.deleteMany(); // Apartments depend on projects
  await prisma.project.deleteMany(); // Projects depend on developers

  await prisma.course.deleteMany();
  await prisma.mortgageProgram.deleteMany();
  await prisma.leadForm.deleteMany();

  await prisma.user.deleteMany(); // Users are referenced by almost everything

  console.log('🧹 Database completely cleaned');

  // 2. Create Admin User
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (process.env.NODE_ENV === 'production' && adminPassword === 'admin123') {
    console.warn('⚠️  WARNING: Using default admin password in production! Set ADMIN_PASSWORD env variable.');
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@casa.kz',
      password: passwordHash,
      firstName: 'Admin',
      lastName: 'ProCasa',
      role: UserRole.ADMIN,
      phone: '+77000000000',
      isActive: true,
    },
  });

  console.log('👤 Admin user created: admin@casa.kz');

  // 3. Optional: Create basic dictionaries (can be commented out if total empty is needed)
  // For now, we leave it completely empty except Admin as requested.

  console.log('✅ Production seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
