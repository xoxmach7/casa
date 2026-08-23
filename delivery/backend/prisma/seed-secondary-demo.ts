// =========================================
// ДЕМО-ДАННЫЕ КОНТУРА ВТОРИЧКИ
// Наполняет Deal Room и очередь оценки, чтобы экраны можно было смотреть и
// обсуждать, а не гадать по пустым таблицам.
//
//   npx tsx prisma/seed-secondary-demo.ts          — создать/обновить
//   npx tsx prisma/seed-secondary-demo.ts --purge  — удалить всё созданное
//
// Идемпотентно: всё пишется по фиксированным id с префиксом `demo_`, поэтому
// повторный запуск обновляет те же записи, а --purge вычищает ровно их и
// ничего больше. Пароль демо-пользователей берётся из DEMO_SEED_PASSWORD.
// =========================================

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const P = 'demo_'; // префикс, по которому демо-записи отличаются от боевых
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD;
if (!DEMO_PASSWORD) throw new Error('DEMO_SEED_PASSWORD is required to run demo seed');

// Даты фиксированные, чтобы повторный запуск не «двигал» историю.
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-09T09:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY);

async function purge() {
  // Порядок важен: сначала то, что ссылается, потом то, на что ссылаются.
  await prisma.auditLog.deleteMany({ where: { entityId: { startsWith: P } } });
  await prisma.comparable.deleteMany({ where: { valuationVersionId: { startsWith: P } } });
  await prisma.valuationVersion.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.valuation.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.marketReference.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.dealRisk.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.dealBooking.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.dealDeposit.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.dealPrecheck.deleteMany({ where: { dealId: { startsWith: P } } });
  await prisma.secondaryDeal.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.offer.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.buyer.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.crmProperty.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.seller.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: P } } });
  console.log('🧹 Демо-данные вторички удалены');
}

async function upsertUser(id: string, email: string, firstName: string, lastName: string, role: UserRole) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { id },
    update: { email, firstName, lastName, role, isActive: true },
    create: { id, email, password, firstName, lastName, role, isActive: true },
  });
}

async function main() {
  if (process.argv.includes('--purge')) {
    await purge();
    return;
  }

  // Чистим перед записью: так повторный запуск не оставляет хвостов от
  // предыдущей версии сценария.
  await purge();

  // ── Роли контура вторички ────────────────────────────────────────────
  const coordinator = await upsertUser(
    `${P}user_coordinator`, 'coordinator@casa.kz', 'Дана', 'Коордиева', UserRole.COORDINATOR
  );
  const analyst = await upsertUser(
    `${P}user_analyst`, 'analyst@casa.kz', 'Тимур', 'Аналитов', UserRole.ANALYST
  );
  // Брокер — владелец объектов и покупателей; отдельный, чтобы демо не
  // приклеивалось к боевым записям существующих брокеров.
  const broker = await upsertUser(
    `${P}user_broker`, 'broker.demo@casa.kz', 'Асель', 'Брокерова', UserRole.BROKER
  );
  console.log('👥 Демо-пользователи созданы; пароль не выводится в лог.');

  const seller = await prisma.seller.create({
    data: {
      id: `${P}seller_1`,
      firstName: 'Марат',
      lastName: 'Сериков',
      phone: '+77011112233',
      brokerId: broker.id,
    },
  });

  // ── Объекты вторички ─────────────────────────────────────────────────
  const propertySpecs = [
    { key: 'a', complex: 'Prime Garden', district: 'Есиль', address: 'Жошы хана, 27', rooms: 2, area: 61.5, floor: 4, totalFloors: 12, year: 2021, price: 38_500_000 },
    { key: 'b', complex: 'Highvill', district: 'Есиль', address: 'Туркестан, 14', rooms: 3, area: 88.0, floor: 9, totalFloors: 16, year: 2019, price: 62_000_000 },
    { key: 'c', complex: 'Grand Turan', district: 'Алматы', address: 'Кабанбай батыра, 46', rooms: 1, area: 42.3, floor: 2, totalFloors: 9, year: 2015, price: 24_900_000 },
    { key: 'd', complex: 'Северное сияние', district: 'Сарыарка', address: 'Достык, 5', rooms: 2, area: 58.0, floor: 11, totalFloors: 14, year: 2012, price: 33_200_000 },
    { key: 'e', complex: 'Изумрудный квартал', district: 'Байконур', address: 'Сыганак, 60', rooms: 4, area: 120.0, floor: 7, totalFloors: 18, year: 2023, price: 95_000_000 },
    // Объект с принятым оффером, но без комнаты сделки — чтобы можно было
    // нажать «Комната сделки» в карточке объекта и увидеть, как сделка
    // появляется на доске.
    { key: 'f', complex: 'Астана Резиденс', district: 'Алматы', address: 'Сарайшык, 34', rooms: 2, area: 54.7, floor: 6, totalFloors: 10, year: 2018, price: 29_800_000 },
  ];

  const properties: Record<string, { id: string; price: number }> = {};
  for (const s of propertySpecs) {
    const p = await prisma.crmProperty.create({
      data: {
        id: `${P}prop_${s.key}`,
        rooms: s.rooms,
        residentialComplex: s.complex,
        district: s.district,
        address: s.address,
        area: s.area,
        floor: s.floor,
        totalFloors: s.totalFloors,
        yearBuilt: s.year,
        price: s.price,
        pricePerSqm: Math.round(s.price / s.area),
        sellerId: seller.id,
        brokerId: broker.id,
      },
    });
    properties[s.key] = { id: p.id, price: s.price };
  }
  console.log(`🏢 Объектов: ${propertySpecs.length}`);

  // ── Покупатели ───────────────────────────────────────────────────────
  const buyerSpecs = [
    { key: 'a', firstName: 'Айгуль', lastName: 'Нурланова', phone: '+77015550001', max: 40_000_000 },
    { key: 'b', firstName: 'Ерлан', lastName: 'Досжанов', phone: '+77015550002', max: 65_000_000 },
    { key: 'c', firstName: 'Салтанат', lastName: 'Ким', phone: '+77015550003', max: 26_000_000 },
    { key: 'd', firstName: 'Бауыржан', lastName: 'Абенов', phone: '+77015550004', max: 35_000_000 },
    { key: 'e', firstName: 'Жанна', lastName: 'Тулегенова', phone: '+77015550005', max: 100_000_000 },
    { key: 'f', firstName: 'Нурлан', lastName: 'Сагинтаев', phone: '+77015550006', max: 31_000_000 },
  ];
  const buyers: Record<string, string> = {};
  for (const b of buyerSpecs) {
    const created = await prisma.buyer.create({
      data: {
        id: `${P}buyer_${b.key}`,
        firstName: b.firstName,
        lastName: b.lastName,
        phone: b.phone,
        maxBudget: b.max,
        brokerId: broker.id,
      },
    });
    buyers[b.key] = created.id;
  }

  // ── Сделки: по одной в каждой фазе доски ─────────────────────────────
  // Так на доске видно все колонки сразу, а не одну заполненную.
  const dealSpecs = [
    {
      key: 'a', prop: 'a', buyer: 'a',
      stage: 'SELLER_REVIEW' as const, light: 'RED' as const,
      offerPrice: 37_000_000, finalPrice: null as number | null,
      precheck: { buyerVerified: true, sellerVerified: false, propertyVerified: false, paymentRouteConfirmed: false, completenessPercent: 25, hasBlockingRisk: false, missingAmount: 0, mortgagePartConfirmed: true },
      deposit: { status: 'NOT_ALLOWED' as const, amount: null as number | null },
      booking: 'NOT_CREATED' as const,
      risks: [] as { category: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; isBlocker: boolean; resolution?: string; dueDate?: Date; resolvedAt?: Date }[],
      history: [{ action: 'OPEN_DEAL_ROOM', at: daysAgo(3) }, { action: 'TRANSITION', to: 'SELLER_REVIEW', at: daysAgo(2) }],
    },
    {
      key: 'b', prop: 'b', buyer: 'b',
      stage: 'YELLOW_BLOCKED' as const, light: 'YELLOW' as const,
      offerPrice: 60_000_000, finalPrice: 60_000_000,
      precheck: { buyerVerified: true, sellerVerified: true, propertyVerified: false, paymentRouteConfirmed: false, completenessPercent: 55, hasBlockingRisk: true, missingAmount: 4_500_000, mortgagePartConfirmed: false },
      deposit: { status: 'NOT_ALLOWED' as const, amount: null },
      booking: 'NOT_CREATED' as const,
      risks: [
        { category: 'encumbrance', severity: 'HIGH' as const, isBlocker: true, resolution: 'Ипотека Halyk не снята — ждём справку об остатке долга', dueDate: daysAhead(5) },
        { category: 'payment', severity: 'MEDIUM' as const, isBlocker: false, resolution: 'Покупатель не подтвердил источник 4,5 млн ₸' },
      ],
      history: [
        { action: 'OPEN_DEAL_ROOM', at: daysAgo(12) },
        { action: 'TRANSITION', to: 'PRICE_AGREED', at: daysAgo(9) },
        { action: 'TRANSITION', to: 'PRECHECK_IN_PROGRESS', at: daysAgo(6) },
        { action: 'TRANSITION', to: 'YELLOW_BLOCKED', at: daysAgo(4), reason: 'Обнаружено непогашенное обременение' },
      ],
    },
    {
      key: 'c', prop: 'c', buyer: 'c',
      stage: 'DEPOSIT_AGREEMENT_SIGNED' as const, light: 'GREEN_2' as const,
      offerPrice: 24_500_000, finalPrice: 24_500_000,
      precheck: { buyerVerified: true, sellerVerified: true, propertyVerified: true, paymentRouteConfirmed: true, completenessPercent: 100, hasBlockingRisk: false, missingAmount: 0, mortgagePartConfirmed: true },
      deposit: { status: 'SIGNED' as const, amount: 1_000_000 },
      booking: 'NOT_CREATED' as const,
      risks: [
        { category: 'documents', severity: 'LOW' as const, isBlocker: false, resolution: 'Техпаспорт получен', resolvedAt: daysAgo(2) },
      ],
      history: [
        { action: 'OPEN_DEAL_ROOM', at: daysAgo(20) },
        { action: 'TRANSITION', to: 'PRICE_AGREED', at: daysAgo(17) },
        { action: 'TRANSITION', to: 'GREEN_1', at: daysAgo(12) },
        { action: 'TRANSITION', to: 'GREEN_2', at: daysAgo(9) },
        { action: 'TRANSITION', to: 'DEPOSIT_AGREEMENT_SENT', at: daysAgo(5) },
        { action: 'TRANSITION', to: 'DEPOSIT_AGREEMENT_SIGNED', at: daysAgo(3) },
      ],
    },
    {
      key: 'd', prop: 'd', buyer: 'd',
      stage: 'BOOKING_ACTIVE' as const, light: 'GREEN_2' as const,
      offerPrice: 32_800_000, finalPrice: 32_800_000,
      precheck: { buyerVerified: true, sellerVerified: true, propertyVerified: true, paymentRouteConfirmed: true, completenessPercent: 100, hasBlockingRisk: false, missingAmount: 0, mortgagePartConfirmed: true },
      deposit: { status: 'TRANSFER_PENDING' as const, amount: 1_500_000, verified: true },
      booking: 'ACTIVE' as const,
      risks: [],
      history: [
        { action: 'OPEN_DEAL_ROOM', at: daysAgo(28) },
        { action: 'TRANSITION', to: 'GREEN_2', at: daysAgo(18) },
        { action: 'VERIFY_DEPOSIT_TRANSFER', at: daysAgo(8), reason: 'Платёжное поручение Kaspi, сверено с продавцом по телефону' },
        { action: 'TRANSITION', to: 'BOOKING_ACTIVE', at: daysAgo(7) },
      ],
    },
    {
      key: 'e', prop: 'e', buyer: 'e',
      stage: 'SOLD' as const, light: 'GREEN_2' as const,
      offerPrice: 93_000_000, finalPrice: 93_000_000,
      precheck: { buyerVerified: true, sellerVerified: true, propertyVerified: true, paymentRouteConfirmed: true, completenessPercent: 100, hasBlockingRisk: false, missingAmount: 0, mortgagePartConfirmed: true },
      deposit: { status: 'RECEIVED' as const, amount: 3_000_000, verified: true },
      booking: 'CONVERTED_TO_SOLD' as const,
      risks: [],
      history: [
        { action: 'OPEN_DEAL_ROOM', at: daysAgo(60) },
        { action: 'TRANSITION', to: 'BOOKING_ACTIVE', at: daysAgo(35) },
        { action: 'TRANSITION', to: 'READY_FOR_NOTARY', at: daysAgo(20) },
        { action: 'TRANSITION', to: 'REGISTRATION_OR_DISBURSEMENT', at: daysAgo(12) },
        { action: 'TRANSITION', to: 'SOLD', at: daysAgo(6), reason: 'Регистрация в ЦОН завершена, деньги выданы продавцу' },
      ],
      outcome: { at: daysAgo(6), reason: 'Регистрация в ЦОН завершена, деньги выданы продавцу' },
    },
  ];

  for (const d of dealSpecs) {
    const offer = await prisma.offer.create({
      data: {
        id: `${P}offer_${d.key}`,
        price: d.offerPrice,
        status: 'ACCEPTED',
        propertyId: properties[d.prop].id,
        buyerId: buyers[d.buyer],
      },
    });

    await prisma.secondaryDeal.create({
      data: {
        id: `${P}deal_${d.key}`,
        propertyId: properties[d.prop].id,
        buyerId: buyers[d.buyer],
        offerId: offer.id,
        coordinatorId: coordinator.id,
        stage: d.stage,
        trafficLight: d.light,
        finalPrice: d.finalPrice ?? undefined,
        version: d.history.length,
        outcomeAt: (d as any).outcome?.at,
        outcomeReason: (d as any).outcome?.reason,
      },
    });

    await prisma.dealPrecheck.create({ data: { dealId: `${P}deal_${d.key}`, ...d.precheck } });
    await prisma.dealDeposit.create({
      data: {
        dealId: `${P}deal_${d.key}`,
        status: d.deposit.status,
        amount: d.deposit.amount ?? undefined,
        proofType: (d.deposit as any).verified ? 'bank_transfer' : undefined,
        proofFileAssetId: (d.deposit as any).verified ? `${P}file_${d.key}` : undefined,
        coordinatorVerified: Boolean((d.deposit as any).verified),
        verifiedBy: (d.deposit as any).verified ? coordinator.id : undefined,
        verifiedAt: (d.deposit as any).verified ? daysAgo(8) : undefined,
      },
    });
    await prisma.dealBooking.create({ data: { dealId: `${P}deal_${d.key}`, status: d.booking } });

    for (const [i, r] of d.risks.entries()) {
      await prisma.dealRisk.create({
        data: {
          id: `${P}risk_${d.key}_${i}`,
          dealId: `${P}deal_${d.key}`,
          category: r.category,
          severity: r.severity,
          isBlocker: r.isBlocker,
          resolution: r.resolution,
          dueDate: r.dueDate,
          resolvedAt: r.resolvedAt,
          ownerId: coordinator.id,
        },
      });
    }

    for (const [i, h] of d.history.entries()) {
      await prisma.auditLog.create({
        data: {
          id: `${P}log_${d.key}_${i}`,
          actorUserId: coordinator.id,
          actorRole: 'COORDINATOR',
          action: h.action,
          entityType: 'SecondaryDeal',
          entityId: `${P}deal_${d.key}`,
          newValues: (h as any).to ? { stage: (h as any).to } : undefined,
          reason: (h as any).reason,
          createdAt: h.at,
        },
      });
    }
  }
  console.log(`🤝 Сделок: ${dealSpecs.length} (по одной в каждой фазе доски)`);

  // Принятый оффер без комнаты — точка входа для демонстрации связки
  // «оффер → комната сделки».
  await prisma.offer.create({
    data: {
      id: `${P}offer_f`,
      price: 29_000_000,
      status: 'ACCEPTED',
      comment: 'Готов выйти на сделку в течение месяца',
      propertyId: properties.f.id,
      buyerId: buyers.f,
    },
  });
  console.log('📬 Плюс один принятый оффер без комнаты (Астана Резиденс) — на нём видно кнопку «Комната сделки»');

  // ── Оценка ───────────────────────────────────────────────────────────
  const reference = await prisma.marketReference.create({
    data: {
      id: `${P}ref_esil_2k`,
      cityId: 'almaty',
      districtId: 'Есиль',
      residentialComplexId: 'Prime Garden',
      rooms: 2,
      basePricePerM2Low: 590_000,
      basePricePerM2High: 680_000,
      sourceDate: daysAgo(14),
      validUntil: daysAhead(45),
    },
  });

  // 1. Подтверждённая оценка — полный цикл с аналогами и решением ревьюера.
  await prisma.valuation.create({
    data: { id: `${P}val_confirmed`, propertyId: properties.a.id, status: 'ACCEPTED', currentVersion: 1 },
  });
  await prisma.valuationVersion.create({
    data: {
      id: `${P}valver_confirmed_1`,
      valuationId: `${P}val_confirmed`,
      versionNumber: 1,
      preliminaryLow: 36_285_000,
      preliminaryHigh: 41_820_000,
      confirmedLow: 37_000_000,
      confirmedHigh: 40_500_000,
      urgentLow: 34_000_000,
      urgentHigh: 36_000_000,
      recommendedLaunchPrice: 39_500_000,
      maxLaunchPrice: 41_000_000,
      liquidity: 'HIGH',
      confidence: 'HIGH',
      decision: 'ACCEPTED',
      reviewerReason: 'Три прямых аналога в том же ЖК, разброс цены за м² в пределах 4%.',
      reviewerId: coordinator.id,
      reviewedAt: daysAgo(4),
      isImmutable: true,
      marketReferenceId: reference.id,
      createdAt: daysAgo(6),
    },
  });
  const comparables = [
    { ref: 'krisha.kz/a/show/1001', price: 38_900_000, area: 60.0, compat: 'DIRECT' as const, included: true },
    { ref: 'krisha.kz/a/show/1002', price: 40_100_000, area: 63.5, compat: 'DIRECT' as const, included: true },
    { ref: 'krisha.kz/a/show/1003', price: 37_400_000, area: 59.0, compat: 'DIRECT' as const, included: true },
    { ref: 'krisha.kz/a/show/1004', price: 44_000_000, area: 72.0, compat: 'CLOSE' as const, included: true },
    { ref: 'krisha.kz/a/show/1005', price: 52_000_000, area: 61.0, compat: 'MARKET_CONTEXT' as const, included: false, reason: 'Дизайнерский ремонт и мебель — не сопоставимо по состоянию' },
  ];
  for (const [i, c] of comparables.entries()) {
    await prisma.comparable.create({
      data: {
        id: `${P}cmp_${i}`,
        valuationVersionId: `${P}valver_confirmed_1`,
        sourceRef: c.ref,
        checkedAt: daysAgo(7),
        askingPrice: c.price,
        totalArea: c.area,
        pricePerM2: Math.round(c.price / c.area),
        compatibility: c.compat,
        included: c.included,
        reasonExcluded: (c as any).reason,
      },
    });
  }

  // 2. Ждёт ручного разбора — эталона по этому ЖК нет, и цена не выдумывается.
  await prisma.valuation.create({
    data: { id: `${P}val_manual`, propertyId: properties.e.id, status: 'MANUAL_REVIEW_REQUIRED', currentVersion: 1 },
  });
  await prisma.valuationVersion.create({
    data: {
      id: `${P}valver_manual_1`,
      valuationId: `${P}val_manual`,
      versionNumber: 1,
      createdAt: daysAgo(1),
    },
  });

  // 3. Предварительный расчёт готов, ждёт человека.
  await prisma.valuation.create({
    data: { id: `${P}val_preliminary`, propertyId: properties.d.id, status: 'PRELIMINARY_READY', currentVersion: 1 },
  });
  await prisma.valuationVersion.create({
    data: {
      id: `${P}valver_preliminary_1`,
      valuationId: `${P}val_preliminary`,
      versionNumber: 1,
      preliminaryLow: 31_200_000,
      preliminaryHigh: 35_400_000,
      marketReferenceId: reference.id,
      createdAt: daysAgo(2),
    },
  });

  // 4. Только что поданная заявка — очередь начинается отсюда.
  await prisma.valuation.create({
    data: { id: `${P}val_submitted`, propertyId: properties.c.id, status: 'SUBMITTED', currentVersion: 0 },
  });

  for (const [i, entry] of [
    { id: `${P}val_confirmed`, action: 'CREATE', at: daysAgo(6) },
    { id: `${P}val_confirmed`, action: 'CALCULATE_PRELIMINARY', at: daysAgo(6) },
    { id: `${P}val_confirmed`, action: 'CONFIRM', at: daysAgo(4), reason: 'Три прямых аналога, разброс 4%' },
    { id: `${P}val_manual`, action: 'CALCULATE_PRELIMINARY', at: daysAgo(1) },
  ].entries()) {
    await prisma.auditLog.create({
      data: {
        id: `${P}vlog_${i}`,
        actorUserId: i === 3 ? analyst.id : coordinator.id,
        actorRole: i === 3 ? 'ANALYST' : 'COORDINATOR',
        action: entry.action,
        entityType: 'Valuation',
        entityId: entry.id,
        reason: (entry as any).reason,
        createdAt: entry.at,
      },
    });
  }
  console.log('📐 Оценок: 4 (подтверждённая, ручной разбор, предварительная, новая заявка)');

  console.log('\n✅ Готово. Войти можно так:');
  console.log('   coordinator@casa.kz / пароль из DEMO_SEED_PASSWORD  — видит и двигает сделки');
  console.log('   analyst@casa.kz     / пароль из DEMO_SEED_PASSWORD  — видит, но двигать не может');
  console.log('   broker.demo@casa.kz / пароль из DEMO_SEED_PASSWORD  — контур вторички ему не виден');
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
