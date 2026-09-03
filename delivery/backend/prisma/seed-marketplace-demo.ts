// =========================================
// ДЕМО-ДАННЫЕ ПОРТАЛА ВТОРИЧКИ
//
// Агентов и объектов на площадке пока нет, а проверять её надо уже сейчас.
// Этот сид наполняет все состояния, ради которых портал строился: объект в
// модерации, объект без договора, два уровня договора, живая фиксация,
// истёкшая фиксация в защитном периоде, закрытая сделка с комиссией и
// спор о продаже мимо площадки.
//
//   npx tsx prisma/seed-marketplace-demo.ts          — создать/обновить
//   npx tsx prisma/seed-marketplace-demo.ts --purge  — удалить всё созданное
//
// Идемпотентно: всё пишется по фиксированным id с префиксом `mkt_`, поэтому
// повторный запуск обновляет те же записи, а --purge вычищает ровно их.
// Пароль демо-пользователей берётся из DEMO_SEED_PASSWORD.
// =========================================

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const P = 'mkt_';
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD;
if (!DEMO_PASSWORD) {
  throw new Error('DEMO_SEED_PASSWORD is required to run marketplace demo seed');
}

const IDENTITY_KEY =
  process.env.MARKETPLACE_IDENTITY_HMAC_KEY || process.env.IIN_LOOKUP_HMAC_KEY;
if (!IDENTITY_KEY || IDENTITY_KEY.length < 32) {
  throw new Error(
    'MARKETPLACE_IDENTITY_HMAC_KEY (>=32 символов) обязателен: без него отпечатки покупателей не совпадут с боевыми',
  );
}

/** Тот же расчёт, что в lib/marketplace/identity.ts. */
function identityHash(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized =
    digits.length === 11 ? `7${digits.slice(1)}` : digits.length === 10 ? `7${digits}` : digits;
  return crypto.createHmac('sha256', IDENTITY_KEY!).update(normalized, 'utf8').digest('hex');
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-03T09:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY);

async function purge() {
  // Порядок важен: сначала ссылающиеся записи, потом те, на которые ссылаются.
  await prisma.commissionStatusLog.deleteMany({ where: { commissionId: { startsWith: P } } });
  await prisma.commission.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.listingExit.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.secondaryFixationStatusLog.deleteMany({ where: { fixationId: { startsWith: P } } });
  await prisma.secondaryFixation.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.dealRisk.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.dealBooking.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.dealDeposit.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.dealPrecheck.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.secondaryDeal.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.offer.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.show.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.listingAgreement.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.buyer.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.crmProperty.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.seller.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.agencySubscription.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: P } } });
  console.log('Демо-данные портала вторички удалены.');
}

interface OwnerSpec {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
}

const OWNERS: OwnerSpec[] = [
  { key: 'aigul', firstName: 'Айгуль', lastName: 'Сериккызы', phone: '+77011110001', city: 'Астана' },
  { key: 'marat', firstName: 'Марат', lastName: 'Досжанов', phone: '+77011110002', city: 'Астана' },
  { key: 'elena', firstName: 'Елена', lastName: 'Ким', phone: '+77011110003', city: 'Алматы' },
  { key: 'nurlan', firstName: 'Нурлан', lastName: 'Абдиров', phone: '+77011110004', city: 'Алматы' },
];

interface ListingSpec {
  key: string;
  owner: string;
  rooms: number;
  residentialComplex: string;
  district: string;
  address: string;
  area: number;
  floor: number;
  totalFloors: number;
  yearBuilt: number;
  price: string;
  lat: number;
  lng: number;
  description: string;
  /** null — объект ещё на модерации, договора нет вовсе. */
  tier: 'BASIC' | 'EXCLUSIVE' | null;
  /** DRAFT — условия выбраны, но не приняты: публиковать нельзя. */
  agreementStatus?: 'DRAFT' | 'ACTIVE';
  status: 'ACTIVE' | 'MODERATION';
}

const LISTINGS: ListingSpec[] = [
  {
    key: 'l1', owner: 'aigul', rooms: 3, residentialComplex: 'ЖК Северное сияние',
    district: 'Есильский', address: 'ул. Достык, 12, кв. 45', area: 78.5, floor: 7,
    totalFloors: 12, yearBuilt: 2019, price: '30000000.00', lat: 51.128422, lng: 71.430564,
    description: 'Просторная трёхкомнатная с ремонтом, окна во двор, тихий подъезд.',
    tier: 'EXCLUSIVE', agreementStatus: 'ACTIVE', status: 'ACTIVE',
  },
  {
    key: 'l2', owner: 'aigul', rooms: 1, residentialComplex: 'ЖК Асыл Арман',
    district: 'Алматинский', address: 'ул. Кенесары, 40, кв. 112', area: 42.0, floor: 3,
    totalFloors: 9, yearBuilt: 2015, price: '18500000.00', lat: 51.169392, lng: 71.449074,
    description: 'Однокомнатная рядом с метро, сдаётся с мебелью.',
    tier: 'BASIC', agreementStatus: 'ACTIVE', status: 'ACTIVE',
  },
  {
    key: 'l3', owner: 'marat', rooms: 2, residentialComplex: 'ЖК Хайвилл',
    district: 'Есильский', address: 'пр. Мангилик Ел, 55, кв. 8', area: 61.3, floor: 11,
    totalFloors: 16, yearBuilt: 2021, price: '26400000.00', lat: 51.089711, lng: 71.418266,
    description: 'Двухкомнатная с панорамными окнами, закрытая территория.',
    tier: 'EXCLUSIVE', agreementStatus: 'ACTIVE', status: 'ACTIVE',
  },
  {
    key: 'l4', owner: 'elena', rooms: 4, residentialComplex: 'ЖК Алатау Гранд',
    district: 'Бостандыкский', address: 'ул. Тимирязева, 3, кв. 20', area: 112.7, floor: 5,
    totalFloors: 10, yearBuilt: 2012, price: '58000000.00', lat: 43.234517, lng: 76.906634,
    description: 'Четырёхкомнатная у парка, два санузла, паркинг в собственности.',
    tier: 'BASIC', agreementStatus: 'ACTIVE', status: 'ACTIVE',
  },
  {
    key: 'l5', owner: 'elena', rooms: 2, residentialComplex: 'ЖК Керемет',
    district: 'Медеуский', address: 'ул. Абая, 150, кв. 77', area: 68.0, floor: 9,
    totalFloors: 14, yearBuilt: 2017, price: '39900000.00', lat: 43.238949, lng: 76.889709,
    description: 'Вид на горы, свежий ремонт, кухня-гостиная.',
    tier: 'EXCLUSIVE', agreementStatus: 'ACTIVE', status: 'ACTIVE',
  },
  {
    key: 'l6', owner: 'nurlan', rooms: 3, residentialComplex: 'ЖК Нурсая',
    district: 'Есильский', address: 'ул. Сыганак, 10, кв. 33', area: 84.2, floor: 2,
    totalFloors: 9, yearBuilt: 2014, price: '33500000.00', lat: 51.113762, lng: 71.404816,
    description: 'Трёхкомнатная на низком этаже, удобно с коляской.',
    tier: 'BASIC', agreementStatus: 'ACTIVE', status: 'ACTIVE',
  },
  // Объект на модерации с выбранными, но НЕ принятыми условиями: проверяет,
  // что гейт публикации держит именно принятие, а не наличие записи.
  {
    key: 'l7', owner: 'marat', rooms: 1, residentialComplex: 'ЖК Легенда',
    district: 'Сарыаркинский', address: 'ул. Бейбитшилик, 25, кв. 5', area: 38.4, floor: 4,
    totalFloors: 12, yearBuilt: 2018, price: '16900000.00', lat: 51.181298, lng: 71.427094,
    description: 'Компактная однушка под сдачу.',
    tier: 'BASIC', agreementStatus: 'DRAFT', status: 'MODERATION',
  },
  // Объект вообще без договора — не должен появляться в витрине ни при каких
  // условиях, даже если модератор его одобрит.
  {
    key: 'l8', owner: 'nurlan', rooms: 2, residentialComplex: 'ЖК Ботанический сад',
    district: 'Бостандыкский', address: 'ул. Тимирязева, 89, кв. 14', area: 55.1, floor: 6,
    totalFloors: 8, yearBuilt: 2010, price: '31200000.00', lat: 43.222981, lng: 76.910774,
    description: 'Двухкомнатная рядом с ботсадом, требует косметики.',
    tier: null, status: 'MODERATION',
  },
];

async function seed() {
  const password = await bcrypt.hash(DEMO_PASSWORD!, 10);

  // --- Агентство и агенты ------------------------------------------------
  const agency = await prisma.user.upsert({
    where: { id: `${P}agency` },
    update: {},
    create: {
      id: `${P}agency`,
      email: 'agency@marketplace.demo',
      password,
      role: 'AGENCY',
      status: 'ACTIVE',
      firstName: 'Астана',
      lastName: 'Недвижимость',
      companyName: 'АН «Астана Недвижимость»',
      phone: '+77012220000',
      city: 'Астана',
    },
  });

  const agents = await Promise.all(
    [
      { key: 'agent1', firstName: 'Дана', lastName: 'Ержанова', phone: '+77012220001' },
      { key: 'agent2', firstName: 'Тимур', lastName: 'Касымов', phone: '+77012220002' },
    ].map((spec) =>
      prisma.user.upsert({
        where: { id: `${P}${spec.key}` },
        update: { curatorId: agency.id },
        create: {
          id: `${P}${spec.key}`,
          email: `${spec.key}@marketplace.demo`,
          password,
          role: 'BROKER',
          status: 'ACTIVE',
          firstName: spec.firstName,
          lastName: spec.lastName,
          phone: spec.phone,
          city: 'Астана',
          curatorId: agency.id,
        },
      }),
    ),
  );

  // Независимый агент — платит сам за себя, тариф TRIAL с жёстким лимитом.
  const solo = await prisma.user.upsert({
    where: { id: `${P}solo` },
    update: {},
    create: {
      id: `${P}solo`,
      email: 'solo@marketplace.demo',
      password,
      role: 'BROKER',
      status: 'ACTIVE',
      firstName: 'Аслан',
      lastName: 'Мукашев',
      phone: '+77012220003',
      city: 'Алматы',
    },
  });

  // Координатор CASA — ведёт объекты и разбирает споры.
  await prisma.user.upsert({
    where: { id: `${P}coord` },
    update: {},
    create: {
      id: `${P}coord`,
      email: 'coordinator@marketplace.demo',
      password,
      role: 'COORDINATOR',
      status: 'ACTIVE',
      firstName: 'Сауле',
      lastName: 'Нурпеисова',
      phone: '+77012220009',
      city: 'Астана',
    },
  });

  await prisma.agencySubscription.upsert({
    where: { id: `${P}sub_agency` },
    update: { status: 'ACTIVE', plan: 'PRO', maxActiveFixations: 60, maxAgents: 20 },
    create: {
      id: `${P}sub_agency`,
      agencyId: agency.id,
      plan: 'PRO',
      status: 'ACTIVE',
      maxActiveFixations: 60,
      maxAgents: 20,
      startsAt: daysAgo(30),
      expiresAt: daysAhead(335),
      amount: new Prisma.Decimal('150000.00'),
    },
  });

  await prisma.agencySubscription.upsert({
    where: { id: `${P}sub_solo` },
    update: { status: 'ACTIVE', plan: 'TRIAL', maxActiveFixations: 3, maxAgents: 2 },
    create: {
      id: `${P}sub_solo`,
      agencyId: solo.id,
      plan: 'TRIAL',
      status: 'ACTIVE',
      maxActiveFixations: 3,
      maxAgents: 2,
      startsAt: daysAgo(5),
      expiresAt: daysAhead(9),
      amount: null,
    },
  });

  // --- Собственники ------------------------------------------------------
  const sellerByOwner: Record<string, string> = {};
  for (const owner of OWNERS) {
    const user = await prisma.user.upsert({
      where: { id: `${P}owner_${owner.key}` },
      update: {},
      create: {
        id: `${P}owner_${owner.key}`,
        email: `${owner.key}@owner.demo`,
        password,
        role: 'OWNER',
        status: 'ACTIVE',
        firstName: owner.firstName,
        lastName: owner.lastName,
        phone: owner.phone,
        city: owner.city,
      },
    });

    const seller = await prisma.seller.upsert({
      where: { id: `${P}seller_${owner.key}` },
      update: { userId: user.id },
      create: {
        id: `${P}seller_${owner.key}`,
        firstName: owner.firstName,
        lastName: owner.lastName,
        phone: owner.phone,
        email: `${owner.key}@owner.demo`,
        city: owner.city,
        source: 'SELF_REGISTRATION',
        brokerId: user.id,
        userId: user.id,
        funnelStage: 'CONTRACT_SIGNING',
        readyForExclusive: true,
      },
    });
    sellerByOwner[owner.key] = seller.id;
  }

  // --- Объекты и договоры ------------------------------------------------
  for (const listing of LISTINGS) {
    const { key, owner, tier, agreementStatus, status, ...fields } = listing;
    const propertyId = `${P}prop_${key}`;

    await prisma.crmProperty.upsert({
      where: { id: propertyId },
      update: { status, price: new Prisma.Decimal(fields.price) },
      create: {
        id: propertyId,
        ...fields,
        price: new Prisma.Decimal(fields.price),
        sellerId: sellerByOwner[owner],
        brokerId: `${P}owner_${owner}`,
        listingSource: 'OWNER_SELF',
        status,
        funnelStage: status === 'ACTIVE' ? 'LEADS' : 'CREATED',
        publishedAt: status === 'ACTIVE' ? daysAgo(12) : null,
        images: [],
        // Ссылка на внешнюю площадку — чтобы было видно, что маскировка её
        // прячет: именно она и есть маршрут обхода в один клик.
        krishaUrl: `https://krisha.kz/a/show/demo-${key}`,
      },
    });

    if (!tier) continue;

    const isActive = agreementStatus === 'ACTIVE';
    await prisma.listingAgreement.upsert({
      where: { id: `${P}agr_${key}` },
      update: { status: agreementStatus! },
      create: {
        id: `${P}agr_${key}`,
        propertyId,
        sellerId: sellerByOwner[owner],
        tier,
        commissionPercent: new Prisma.Decimal(tier === 'EXCLUSIVE' ? '1.50' : '2.00'),
        buyerAgentSharePercent: new Prisma.Decimal('50.00'),
        protectionPeriodDays: tier === 'EXCLUSIVE' ? 180 : 90,
        status: agreementStatus!,
        acceptedAt: isActive ? daysAgo(14) : null,
        acceptanceEvidence: isActive ? 'Оферта принята в кабинете собственника (демо)' : null,
      },
    });
  }

  // --- Покупатели агентов ------------------------------------------------
  const BUYERS = [
    { key: 'b1', agent: agents[0].id, firstName: 'Асем', lastName: 'Жумабаева', phone: '+77051110001', min: '25000000', max: '32000000' },
    { key: 'b2', agent: agents[0].id, firstName: 'Ерлан', lastName: 'Сатпаев', phone: '+77051110002', min: '15000000', max: '20000000' },
    { key: 'b3', agent: agents[1].id, firstName: 'Гульмира', lastName: 'Оспанова', phone: '+77051110003', min: '50000000', max: '65000000' },
    { key: 'b4', agent: solo.id, firstName: 'Даулет', lastName: 'Ахметов', phone: '+77051110004', min: '30000000', max: '42000000' },
  ];

  for (const buyer of BUYERS) {
    await prisma.buyer.upsert({
      where: { id: `${P}buyer_${buyer.key}` },
      update: {},
      create: {
        id: `${P}buyer_${buyer.key}`,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        phone: buyer.phone,
        minBudget: new Prisma.Decimal(buyer.min),
        maxBudget: new Prisma.Decimal(buyer.max),
        status: 'ACTIVE',
        brokerId: buyer.agent,
      },
    });
  }

  // --- Фиксации в разных состояниях --------------------------------------
  const FIXATIONS = [
    // Живая фиксация: агент видит адрес и контакты.
    {
      key: 'f1', property: 'l1', buyer: 'b1', agent: agents[0].id, agency: agency.id,
      phone: '+77051110001', status: 'CONFIRMED' as const, share: '50.00',
      created: daysAgo(6), expires: daysAhead(39), protection: daysAhead(219),
    },
    // Дошла до показа.
    {
      key: 'f2', property: 'l3', buyer: 'b1', agent: agents[0].id, agency: agency.id,
      phone: '+77051110001', status: 'SHOWN' as const, share: '50.00',
      created: daysAgo(10), expires: daysAhead(35), protection: daysAhead(215),
    },
    // Дошла до сделки — из неё считается комиссия.
    {
      key: 'f3', property: 'l4', buyer: 'b3', agent: agents[1].id, agency: agency.id,
      phone: '+77051110003', status: 'DEAL' as const, share: '50.00',
      created: daysAgo(40), expires: daysAgo(10), protection: daysAhead(80),
    },
    // Истекла, но защитный период идёт: продажа этому покупателю всё ещё наша.
    {
      key: 'f4', property: 'l6', buyer: 'b4', agent: solo.id, agency: null,
      phone: '+77051110004', status: 'EXPIRED' as const, share: '50.00',
      created: daysAgo(50), expires: daysAgo(20), protection: daysAhead(70),
    },
  ];

  for (const fixation of FIXATIONS) {
    await prisma.secondaryFixation.upsert({
      where: { id: `${P}fix_${fixation.key}` },
      update: { status: fixation.status },
      create: {
        id: `${P}fix_${fixation.key}`,
        propertyId: `${P}prop_${fixation.property}`,
        buyerId: `${P}buyer_${fixation.buyer}`,
        agentId: fixation.agent,
        agencyId: fixation.agency,
        buyerIdentityHash: identityHash(fixation.phone),
        declaredSharePercent: new Prisma.Decimal(fixation.share),
        status: fixation.status,
        sentAt: fixation.created,
        confirmedAt: fixation.created,
        expiresAt: fixation.expires,
        protectionUntil: fixation.protection,
        createdAt: fixation.created,
      },
    });
  }

  // --- Закрытая сделка с комиссией ---------------------------------------
  await prisma.offer.upsert({
    where: { id: `${P}offer_1` },
    update: {},
    create: {
      id: `${P}offer_1`,
      price: new Prisma.Decimal('56000000.00'),
      status: 'ACCEPTED',
      propertyId: `${P}prop_l4`,
      buyerId: `${P}buyer_b3`,
      createdAt: daysAgo(25),
    },
  });

  await prisma.secondaryDeal.upsert({
    where: { id: `${P}deal_1` },
    update: { stage: 'SOLD', finalPrice: new Prisma.Decimal('56000000.00') },
    create: {
      id: `${P}deal_1`,
      propertyId: `${P}prop_l4`,
      buyerId: `${P}buyer_b3`,
      offerId: `${P}offer_1`,
      coordinatorId: `${P}coord`,
      stage: 'SOLD',
      trafficLight: 'GREEN_2',
      finalPrice: new Prisma.Decimal('56000000.00'),
      outcomeAt: daysAgo(8),
      createdAt: daysAgo(25),
    },
  });

  await prisma.secondaryFixation.update({
    where: { id: `${P}fix_f3` },
    data: { secondaryDealId: `${P}deal_1` },
  });

  // 56 000 000 × 2.00% = 1 120 000; агенту 50% = 560 000; CASA 560 000.
  await prisma.commission.upsert({
    where: { id: `${P}comm_1` },
    update: { status: 'CONFIRMED' },
    create: {
      id: `${P}comm_1`,
      secondaryDealId: `${P}deal_1`,
      amount: new Prisma.Decimal('1120000.00'),
      partnerShare: new Prisma.Decimal('560000.00'),
      casaShare: new Prisma.Decimal('560000.00'),
      partnerAgentId: agents[1].id,
      status: 'CONFIRMED',
      createdAt: daysAgo(8),
      statusHistory: {
        create: {
          id: `${P}commlog_1`,
          toStatus: 'CONFIRMED',
          note: 'Начислена автоматически: 2.00% от 56000000, доля агента 50%',
        },
      },
    },
  });

  // --- Спор: собственник заявил продажу мимо площадки ---------------------
  // Покупатель тот же, кого привёл независимый агент, и защитный период идёт.
  await prisma.listingExit.upsert({
    where: { id: `${P}exit_1` },
    update: { disputeOpened: true },
    create: {
      id: `${P}exit_1`,
      propertyId: `${P}prop_l6`,
      outcome: 'SOLD_OUTSIDE',
      buyerIdentityHash: identityHash('+77051110004'),
      declaredPrice: new Prisma.Decimal('32800000.00'),
      declaredBy: `${P}owner_nurlan`,
      comment: 'Продал знакомому, агент не участвовал',
      matchedFixationId: `${P}fix_f4`,
      disputeOpened: true,
      createdAt: daysAgo(2),
    },
  });

  console.log('Демо-данные портала вторички созданы:');
  console.log(`  агентство + ${agents.length} агента, независимый агент, координатор`);
  console.log(`  ${OWNERS.length} собственника, ${LISTINGS.length} объектов`);
  console.log(`  ${BUYERS.length} покупателя, ${FIXATIONS.length} фиксации`);
  console.log('  1 закрытая сделка с комиссией, 1 открытый спор');
  console.log('');
  console.log('Вход (пароль из DEMO_SEED_PASSWORD):');
  console.log('  agent1@marketplace.demo   — агент агентства, тариф PRO');
  console.log('  solo@marketplace.demo     — независимый агент, тариф TRIAL (лимит 3)');
  console.log('  aigul@owner.demo          — собственник с двумя объектами');
  console.log('  coordinator@marketplace.demo — координатор CASA');
}

async function main() {
  if (process.argv.includes('--purge')) {
    await purge();
    return;
  }
  await seed();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
