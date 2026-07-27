import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AlmatySeedRecord {
  district: string;
  residentialComplex: string;
  address: string;
  lat: number;
  lng: number;
  rooms: number;
  area: number;
  price: number;
}

// Representative data — districts, complexes and price ranges are illustrative,
// standing in for real Almaty market data until a real listings source is provided
// (see docs/superpowers/specs/2026-07-27-casa-procasa-integration-design.md).
const RECORDS: AlmatySeedRecord[] = [
  { district: 'Бостандыкский', residentialComplex: 'Comfort City', address: 'ул. Розыбакиева 100', lat: 43.2015, lng: 76.8930, rooms: 1, area: 42, price: 25_000_000 },
  { district: 'Бостандыкский', residentialComplex: 'Comfort City', address: 'ул. Розыбакиева 100', lat: 43.2015, lng: 76.8930, rooms: 2, area: 60, price: 36_000_000 },
  { district: 'Бостандыкский', residentialComplex: 'Comfort City', address: 'ул. Розыбакиева 100', lat: 43.2015, lng: 76.8930, rooms: 3, area: 85, price: 49_000_000 },
  { district: 'Бостандыкский', residentialComplex: 'Green Residence', address: 'ул. Тимирязева 50', lat: 43.2100, lng: 76.9050, rooms: 2, area: 58, price: 38_500_000 },
  { district: 'Бостандыкский', residentialComplex: 'Green Residence', address: 'ул. Тимирязева 50', lat: 43.2100, lng: 76.9050, rooms: 3, area: 90, price: 55_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Central Park', address: 'ул. Абылай хана 45', lat: 43.2570, lng: 76.9280, rooms: 1, area: 40, price: 28_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Central Park', address: 'ул. Абылай хана 45', lat: 43.2570, lng: 76.9280, rooms: 2, area: 62, price: 42_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Достар', address: 'ул. Гоголя 30', lat: 43.2530, lng: 76.9420, rooms: 3, area: 88, price: 58_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Достар', address: 'ул. Гоголя 30', lat: 43.2530, lng: 76.9420, rooms: 1, area: 38, price: 27_500_000 },
  { district: 'Медеуский', residentialComplex: 'Botanica', address: 'ул. Курмангазы 120', lat: 43.2220, lng: 76.9550, rooms: 2, area: 65, price: 45_000_000 },
  { district: 'Медеуский', residentialComplex: 'Botanica', address: 'ул. Курмангазы 120', lat: 43.2220, lng: 76.9550, rooms: 3, area: 95, price: 68_000_000 },
  { district: 'Медеуский', residentialComplex: 'Kok-Tobe View', address: 'ул. Достык 200', lat: 43.2300, lng: 76.9700, rooms: 2, area: 70, price: 52_000_000 },
  { district: 'Ауэзовский', residentialComplex: 'Аксай Тау', address: 'мкр. Аксай-4 12', lat: 43.2390, lng: 76.8540, rooms: 1, area: 39, price: 18_500_000 },
  { district: 'Ауэзовский', residentialComplex: 'Аксай Тау', address: 'мкр. Аксай-4 12', lat: 43.2390, lng: 76.8540, rooms: 2, area: 56, price: 24_000_000 },
  { district: 'Ауэзовский', residentialComplex: 'Шаль', address: 'ул. Шаляпина 15', lat: 43.2280, lng: 76.8650, rooms: 3, area: 80, price: 32_000_000 },
  { district: 'Наурызбайский', residentialComplex: 'Golden City', address: 'мкр. Шугыла 5', lat: 43.1980, lng: 76.8180, rooms: 2, area: 55, price: 20_000_000 },
  { district: 'Наурызбайский', residentialComplex: 'Golden City', address: 'мкр. Шугыла 5', lat: 43.1980, lng: 76.8180, rooms: 3, area: 78, price: 27_000_000 },
  { district: 'Турксибский', residentialComplex: 'Северное Сияние', address: 'ул. Пугачева 8', lat: 43.3050, lng: 76.9020, rooms: 1, area: 40, price: 16_500_000 },
  { district: 'Турксибский', residentialComplex: 'Северное Сияние', address: 'ул. Пугачева 8', lat: 43.3050, lng: 76.9020, rooms: 2, area: 58, price: 22_000_000 },
  { district: 'Жетысуский', residentialComplex: 'Мирас', address: 'ул. Радостовца 200', lat: 43.2790, lng: 76.8340, rooms: 2, area: 54, price: 19_500_000 },
  { district: 'Жетысуский', residentialComplex: 'Мирас', address: 'ул. Радостовца 200', lat: 43.2790, lng: 76.8340, rooms: 3, area: 76, price: 26_000_000 },
  { district: 'Алатауский', residentialComplex: 'Изумрудный Квартал', address: 'мкр. Кундызды 3', lat: 43.3020, lng: 76.8010, rooms: 1, area: 41, price: 15_000_000 },
  { district: 'Алатауский', residentialComplex: 'Изумрудный Квартал', address: 'мкр. Кундызды 3', lat: 43.3020, lng: 76.8010, rooms: 2, area: 57, price: 19_000_000 },
];

async function main() {
  const broker = await prisma.user.findFirst({ where: { role: 'BROKER' } });
  if (!broker) {
    throw new Error('No BROKER user found — run the base seed.sql first');
  }

  for (const record of RECORDS) {
    const seller = await prisma.seller.create({
      data: {
        brokerId: broker.id,
        firstName: 'Продавец',
        lastName: record.residentialComplex,
        phone: `+7700${Math.floor(1000000 + Math.random() * 8999999)}`,
        source: 'Almaty seed dataset',
        funnelStage: 'CONTRACT_SIGNING',
      },
    });

    await prisma.crmProperty.create({
      data: {
        district: record.district,
        residentialComplex: record.residentialComplex,
        address: record.address,
        lat: record.lat,
        lng: record.lng,
        rooms: record.rooms,
        area: record.area,
        floor: Math.min(5, record.rooms + 2),
        totalFloors: 9,
        yearBuilt: 2015,
        price: record.price,
        marketPrice: record.price,
        images: [],
        funnelStage: 'LEADS',
        publishedAt: new Date(),
        sellerId: seller.id,
        brokerId: broker.id,
      },
    });
  }

  console.log(`Seeded ${RECORDS.length} Almaty CrmProperty records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
