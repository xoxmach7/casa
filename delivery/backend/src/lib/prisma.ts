import { PrismaClient } from '@prisma/client';

// Disable Prisma debug logs
delete process.env.DEBUG;

// Singleton pattern для Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
