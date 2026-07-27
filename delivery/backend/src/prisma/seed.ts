import { PrismaClient, UserRole, ClientType, BuildingStatus, ApartmentStatus, BookingStatus, DealStatus, DealStage, SaleReason, PropertyClass, StrategyType, PropertyFunnelStage, SellerFunnelStage } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  // 1. Clean up database
  const deletedBookings = await prisma.booking.deleteMany();
  console.log(`Deleted ${deletedBookings.count} bookings`);

  // Clean Kanban tables first due to foreign keys
  await prisma.propertyCalculationLog.deleteMany();
  await prisma.crmProperty.deleteMany();
  await prisma.sellerDocument.deleteMany();
  await prisma.seller.deleteMany();

  await prisma.deal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.courseProgress.deleteMany();
  await prisma.course.deleteMany();
  await prisma.mortgageProgram.deleteMany();
  await prisma.client.deleteMany();
  await prisma.apartment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.leadForm.deleteMany();

  const deletedUsers = await prisma.user.deleteMany();
  console.log(`Deleted ${deletedUsers.count} users`);

  console.log('🧹 Database cleaned');

  // 2. Create Users (Admin, Developers, Brokers)
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@casa.kz',
      password: passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      phone: '+77010000000',
    },
  });

  const developer = await prisma.user.create({
    data: {
      email: 'developer@bi.group',
      password: passwordHash,
      firstName: 'BI',
      lastName: 'Group',
      role: UserRole.DEVELOPER,
      phone: '+77011111111',
    },
  });

  const brokers = [];
  for (let i = 0; i < 5; i++) {
    const broker = await prisma.user.create({
      data: {
        email: `broker${i + 1}@casa.kz`,
        password: passwordHash,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: UserRole.BROKER,
        phone: faker.phone.number(),
        balance: parseFloat(faker.finance.amount({ min: 0, max: 1000000, dec: 2 })),
      },
    });
    brokers.push(broker);
  }

  console.log('👥 Users created');

  // 3. Create Projects & Apartments (Old logic kept for compatibility)
  const projectNames = ['Green Quarter', 'Nova City', 'Sensata Park', 'Grand Turan', 'Highvill'];
  const districts = ['Есильский', 'Алматинский', 'Сарыаркинский', 'Нура'];

  for (const name of projectNames) {
    const project = await prisma.project.create({
      data: {
        name,
        description: faker.lorem.paragraphs(2),
        city: 'Astana',
        district: faker.helpers.arrayElement(districts),
        address: faker.location.streetAddress(),
        class: faker.helpers.arrayElement(['Comfort', 'Business', 'Premium']),
        buildingStatus: faker.helpers.arrayElement([BuildingStatus.UNDER_CONSTRUCTION, BuildingStatus.COMPLETED]),
        deliveryDate: faker.date.future(),
        developerId: developer.id,
        developerName: 'BI Group',
        developerPhone: '+77019999999',
        images: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=60',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=60',
          'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=60'
        ],
        bonus: '2% bonus for brokers',
      },
    });

    for (let i = 0; i < 5; i++) { // Reduced for speed
      await prisma.apartment.create({
        data: {
          projectId: project.id,
          number: `${i + 1}`,
          floor: faker.number.int({ min: 1, max: 20 }),
          rooms: faker.number.int({ min: 1, max: 4 }),
          area: faker.number.float({ min: 35, max: 150, fractionDigits: 1 }),
          price: parseFloat(faker.finance.amount({ min: 15000000, max: 80000000, dec: 0 })),
          status: faker.helpers.arrayElement([ApartmentStatus.AVAILABLE, ApartmentStatus.RESERVED]),
        },
      });
    }
  }

  // 10. Create Sellers & Properties (New CRM / Kanban)
  console.log('🏗 Creating Kanban Data (Sellers & Properties)...');

  const sellerStages = [
    SellerFunnelStage.CONTACT,
    SellerFunnelStage.INTERVIEW,
    SellerFunnelStage.STRATEGY,
    SellerFunnelStage.CONTRACT_SIGNING
  ];

  const propertyStages = [
    PropertyFunnelStage.CREATED,
    PropertyFunnelStage.PREPARATION,
    PropertyFunnelStage.LEADS,
    PropertyFunnelStage.SHOWS,
    PropertyFunnelStage.DEAL
  ];

  const strategies = [
    StrategyType.MARKET_SALE,
    StrategyType.URGENT_SALE,
    StrategyType.INVESTMENT_EXIT,
    StrategyType.REJECT_OBJECT,
    StrategyType.LOW_LIQUIDITY
  ];

  const reasons = [SaleReason.RELOCATION, SaleReason.SIZE_CHANGE, SaleReason.FINANCIAL_NEED, SaleReason.OTHER];

  for (const broker of brokers) {
    for (let i = 0; i < 4; i++) {
      // Create Seller
      const seller = await prisma.seller.create({
        data: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          phone: faker.phone.number(),
          brokerId: broker.id,
          funnelStage: faker.helpers.arrayElement(sellerStages),
          trustLevel: faker.number.int({ min: 1, max: 5 }),
          expectedPrice: parseFloat(faker.finance.amount({ min: 15_000_000, max: 90_000_000 })),
          reason: faker.helpers.arrayElement(reasons),
          isActive: true,
        }
      });

      // Create Property for Seller
      if (Math.random() > 0.2) {
        await prisma.crmProperty.create({
          data: {
            sellerId: seller.id,
            brokerId: broker.id,
            residentialComplex: faker.company.name() + ' Hills',
            district: faker.location.county(),
            address: faker.location.streetAddress(),
            area: faker.number.float({ min: 30, max: 150, fractionDigits: 1 }),
            price: parseFloat(faker.finance.amount({ min: 15_000_000, max: 90_000_000 })),
            rooms: faker.number.int({ min: 1, max: 4 }),
            floor: faker.number.int({ min: 1, max: 15 }),
            totalFloors: 16,
            yearBuilt: faker.number.int({ min: 1980, max: 2024 }),

            funnelStage: faker.helpers.arrayElement(propertyStages),

            // Auto-calculated fields mock
            calculatedClass: PropertyClass.COMFORT, // Simplified
            activeStrategy: faker.helpers.arrayElement(strategies),
            liquidityScore: faker.number.int({ min: 20, max: 95 }),
            liquidityLevel: 'AVERAGE',
            financeType: 'MORTGAGE_AVAILABLE',
          }
        });
      }
    }
  }
  console.log('✅ Kanban Data Created');

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
