
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching users...');
    const users = await prisma.user.findMany({
        select: {
            email: true,
            role: true,
            firstName: true,
            lastName: true,
            isActive: true
        },
        orderBy: { role: 'asc' }
    });

    if (users.length === 0) {
        console.log('No users found.');
    } else {
        console.table(users);
        console.log('\nDefault password for seeded users: password123');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
