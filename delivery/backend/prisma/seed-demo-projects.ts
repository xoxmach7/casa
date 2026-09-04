// Демо-каталог новостроек. Ничего не удаляет — безопасен для прода.
//
// Прошлая версия сыпала faker: описания на латинице, английские адреса и —
// главное — комнаты, площадь и цену НЕЗАВИСИМО друг от друга. На витрине это
// выглядело как однокомнатная в 121 м² и трёшка 56 м² дороже двушки 109 м².
// Здесь всё связано: планировка задаётся позицией в секции, площадь —
// комнатностью, цена — площадью, классом ЖК и этажом.
import { PrismaClient, BuildingStatus, ApartmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEVELOPER = { name: 'Кемел Құрылыс', phone: '+7 (727) 355-00-11' };

/** Цена за м² по классу (Алматы) — от неё считается стоимость квартиры. */
const PRICE_PER_M2: Record<string, number> = { Comfort: 620_000, Business: 900_000, Premium: 1_400_000 };

/**
 * Типовая секция из четырёх квартир: двушка — однушка — трёшка — двушка.
 * Позиция в секции определяет и комнатность, и площадь, поэтому по стояку
 * планировки совпадают, как в настоящем доме.
 */
const SECTION = [
  { rooms: 2, area: 63.8 },
  { rooms: 1, area: 42.1 },
  { rooms: 3, area: 92.4 },
  { rooms: 2, area: 66.5 },
];

const PROJECTS = [
  {
    name: 'Алатау Резиденс', district: 'Бостандыкский', class: 'Comfort',
    address: 'ул. Розыбакиева, 247',
    description: 'Квартал из четырёх монолитных домов в Бостандыкском районе. Закрытый двор без машин, подземный паркинг, на первых этажах — коммерция и детский сад. Из верхних этажей виден хребет Заилийского Алатау.',
    status: BuildingStatus.UNDER_CONSTRUCTION, delivery: '2026-12-20',
  },
  {
    name: 'Достык Парк', district: 'Медеуский', class: 'Business',
    address: 'пр. Достык, 210',
    description: 'Дом бизнес-класса на Достыке: панорамное остекление, потолки 3 метра, две входные группы с колясочными. Двор спроектирован ландшафтным бюро, до парка Первого Президента десять минут.',
    status: BuildingStatus.UNDER_CONSTRUCTION, delivery: '2027-06-30',
  },
  {
    name: 'Сайран Резиденс', district: 'Ауэзовский', class: 'Comfort',
    address: 'ул. Толе би, 285',
    description: 'Девятиэтажный дом в сложившемся районе у озера Сайран: школа и поликлиника в пешей доступности, остановка у выхода из двора. Отделка white box во всех квартирах.',
    status: BuildingStatus.COMPLETED, delivery: '2026-08-31',
  },
  {
    name: 'Аль-Фараби Хиллс', district: 'Бостандыкский', class: 'Business',
    address: 'пр. Аль-Фараби, 77/8',
    description: 'Малоэтажный квартал в предгорьях с видом на горы. Своя котельная, огороженная территория, гостевая парковка вынесена за периметр двора.',
    status: BuildingStatus.UNDER_CONSTRUCTION, delivery: '2027-03-31',
  },
  {
    name: 'Алматы Тауэрс', district: 'Алмалинский', class: 'Premium',
    address: 'ул. Сатпаева, 90',
    description: 'Две башни премиум-класса в центре: лобби с консьержем, лифты Kone, видовые квартиры с 10 этажа. Паркинг из расчёта одно место на квартиру.',
    status: BuildingStatus.UNDER_CONSTRUCTION, delivery: '2027-12-20',
  },
];


const IMAGES = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=60',
];

const FLOORS = 9;

/** Нижние этажи дешевле верхних — как на рынке, без случайности. */
function priceOf(area: number, cls: string, floor: number): number {
  const raw = area * (PRICE_PER_M2[cls] ?? PRICE_PER_M2.Comfort) * (0.955 + 0.005 * floor);
  return Math.round(raw / 10_000) * 10_000;
}

/**
 * Продано снизу вверх: на первых этажах спрос закрыт, выше — свободно.
 * Детерминированно, чтобы шахматка выглядела одинаково при любом прогоне.
 */
function statusOf(floor: number, unit: number): ApartmentStatus {
  if (floor <= 2) return unit % 2 === 0 ? ApartmentStatus.SOLD : ApartmentStatus.AVAILABLE;
  if (floor === 3 && unit === 1) return ApartmentStatus.RESERVED;
  if (floor === 5 && unit === 3) return ApartmentStatus.RESERVED;
  return ApartmentStatus.AVAILABLE;
}

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
        description: p.description,
        city: 'Алматы',
        district: p.district,
        address: p.address,
        class: p.class,
        buildingStatus: p.status,
        deliveryDate: new Date(p.delivery),
        developerId: developer.id,
        developerName: DEVELOPER.name,
        developerPhone: DEVELOPER.phone,
        images: IMAGES,
        bonus: 'Комиссия агенту — 2% от суммы сделки',
      },
    });
    projectsCreated++;

    for (let floor = 1; floor <= FLOORS; floor++) {
      for (let unit = 1; unit <= SECTION.length; unit++) {
        const plan = SECTION[unit - 1];
        await prisma.apartment.create({
          data: {
            projectId: project.id,
            number: `${floor}${String(unit).padStart(2, '0')}`,
            floor,
            rooms: plan.rooms,
            area: plan.area,
            price: priceOf(plan.area, p.class, floor),
            status: statusOf(floor, unit),
          },
        });
        apartmentsCreated++;
      }
    }
  }

  console.log(`Created ${projectsCreated} project(s) and ${apartmentsCreated} apartment(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
