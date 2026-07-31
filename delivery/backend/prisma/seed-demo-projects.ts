// Non-destructive demo seed: adds sample Project + Apartment ("шахматка")
// data so the CRM catalog isn't empty. Unlike src/prisma/seed.ts, this
// script never deletes anything — safe to run against production.
import { PrismaClient, BuildingStatus, ApartmentStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const PROJECTS = [
  { name: 'Green Quarter', district: 'Есильский', class: 'Comfort' as const },
  { name: 'Nova City', district: 'Алматинский', class: 'Business' as const },
  { name: 'Sensata Park', district: 'Сарыаркинский', class: 'Premium' as const },
  { name: 'Grand Turan', district: 'Нура', class: 'Business' as const },
  { name: 'Highvill', district: 'Есильский', class: 'Premium' as const },
];

async function main() {
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`Skipping: ${existing} project(s) already exist. Nothing was deleted or changed.`);
    return;
  }

  const developer =
    (await prisma.user.findFirst({ where: { role: 'DEVELOPER' } })) ??
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } }));

  if (!developer) {
    throw new Error('No DEVELOPER or ADMIN user found to own the demo projects — aborting.');
  }

  let projectsCreated = 0;
  let apartmentsCreated = 0;

  for (const p of PROJECTS) {
    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: faker.lorem.paragraphs(2),
        city: 'Astana',
        district: p.district,
        address: faker.location.streetAddress(),
        class: p.class,
        buildingStatus: faker.helpers.arrayElement([BuildingStatus.UNDER_CONSTRUCTION, BuildingStatus.COMPLETED]),
        deliveryDate: faker.date.future(),
        developerId: developer.id,
        developerName: 'BI Group',
        developerPhone: '+77019999999',
        images: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=60',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=60',
          'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=60',
        ],
        bonus: '2% bonus for brokers',
      },
    });
    projectsCreated++;

    // A few floors x a few units per floor so the "шахматка" grid has real shape.
    for (let floor = 1; floor <= 9; floor++) {
      for (let unit = 1; unit <= 4; unit++) {
        await prisma.apartment.create({
          data: {
            projectId: project.id,
            number: `${floor}${String(unit).padStart(2, '0')}`,
            floor,
            rooms: faker.number.int({ min: 1, max: 4 }),
            area: faker.number.float({ min: 35, max: 150, fractionDigits: 1 }),
            price: parseFloat(faker.finance.amount({ min: 15000000, max: 80000000, dec: 0 })),
            status: faker.helpers.arrayElement([
              ApartmentStatus.AVAILABLE,
              ApartmentStatus.AVAILABLE,
              ApartmentStatus.AVAILABLE,
              ApartmentStatus.RESERVED,
              ApartmentStatus.SOLD,
            ]),
          },
        });
        apartmentsCreated++;
      }
    }
  }

  console.log(`Created ${projectsCreated} projects and ${apartmentsCreated} apartments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
