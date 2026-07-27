import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@casa.kz' },
    });
    console.log('Found user:', user);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
