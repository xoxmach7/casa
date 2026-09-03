// Проверка гейтов портала вторички на РЕАЛЬНОЙ базе с демо-данными.
// Моки в юнит-тестах проверяют логику; это проверяет, что она соединена с
// базой так, как задумано (индексы, констрейнты, связи).
//
//   npx tsx prisma/check-marketplace.ts

import { prisma } from '../src/lib/prisma';
import { maskProperty } from '../src/lib/marketplace/masking';
import { liveFixationFor, createFixation, findCoveringFixation } from '../src/lib/marketplace/fixation.service';
import { activeAgreementFor } from '../src/lib/marketplace/listing-agreement.service';
import { buyerIdentityHash } from '../src/lib/marketplace/identity';

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  OK   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log('\nВитрина');
  const visible = await prisma.crmProperty.findMany({
    where: { status: 'ACTIVE', listingAgreements: { some: { status: 'ACTIVE' } } },
    select: { id: true },
  });
  check('в витрину попали только объекты с принятым договором', visible.length === 6, `видно ${visible.length}, ожидалось 6`);
  check('объект с черновиком договора не в витрине', !visible.some((v) => v.id === 'mkt_prop_l7'));
  check('объект без договора не в витрине', !visible.some((v) => v.id === 'mkt_prop_l8'));

  console.log('\nМаскировка');
  const property = await prisma.crmProperty.findUnique({
    where: { id: 'mkt_prop_l2' },
    include: { seller: true },
  });
  const noFixation = await liveFixationFor('mkt_prop_l2', 'mkt_agent2');
  const masked = maskProperty(property as any, { unlocked: Boolean(noFixation), tier: 'BASIC' });
  check('агент без фиксации не видит адрес', masked.address === undefined);
  check('агент без фиксации не видит ссылку на Krisha', !JSON.stringify(masked).includes('krisha.kz'));
  check('агент без фиксации не видит контакты собственника', masked.seller === undefined);

  const fixed = await liveFixationFor('mkt_prop_l1', 'mkt_agent1');
  const property1 = await prisma.crmProperty.findUnique({
    where: { id: 'mkt_prop_l1' },
    include: { seller: true },
  });
  const unmasked = maskProperty(property1 as any, { unlocked: Boolean(fixed), tier: 'EXCLUSIVE' });
  check('агент с живой фиксацией видит адрес', unmasked.address === 'ул. Достык, 12, кв. 45');
  check('фиксация найдена как живая', Boolean(fixed), 'liveFixationFor вернул null');

  console.log('\nДубль-чек');
  // Второй агент пытается зафиксировать того же покупателя на тот же объект.
  const clone = await prisma.buyer.upsert({
    where: { id: 'mkt_check_dup_buyer' },
    update: {},
    create: {
      id: 'mkt_check_dup_buyer',
      firstName: 'Асем',
      lastName: 'Жумабаева (дубль)',
      // Тот же телефон, что у mkt_buyer_b1 — другой id, тот же человек.
      phone: '+7 (705) 111-00-01',
      status: 'ACTIVE',
      brokerId: 'mkt_agent2',
    },
  });
  let dupCode = '';
  await createFixation({
    propertyId: 'mkt_prop_l1',
    buyerId: clone.id,
    agentId: 'mkt_agent2',
    agencyId: 'mkt_agency',
  }).catch((e) => { dupCode = e.code; });
  check('тот же человек с другим id отлавливается по отпечатку', dupCode === 'REJECTED_DUPLICATE', `код: ${dupCode || 'фиксация создалась'}`);

  console.log('\nЗащитный период');
  const covering = await findCoveringFixation('mkt_prop_l6', buyerIdentityHash('+77051110004'));
  check('истёкшая фиксация всё ещё покрывает сделку', Boolean(covering) && covering!.status === 'EXPIRED');

  console.log('\nДеньги');
  const commission = await prisma.commission.findUnique({ where: { id: 'mkt_comm_1' } });
  check('комиссия привязана к сделке вторички', commission?.secondaryDealId === 'mkt_deal_1');
  check('комиссия не привязана к сделке новостройки', commission?.dealId === null);
  const parts = Number(commission?.partnerShare) + Number(commission?.casaShare);
  check('доли сходятся с целым', parts === Number(commission?.amount), `${parts} против ${commission?.amount}`);

  console.log('\nИнварианты БД');
  let checkViolated = false;
  await prisma.$executeRawUnsafe(
    `INSERT INTO commissions (id, amount, status, created_at, updated_at) VALUES ('mkt_bad', 1, 'ESTIMATED', now(), now())`,
  ).catch(() => { checkViolated = true; });
  check('комиссия без обеих ссылок отвергается базой', checkViolated);

  let dupAgreement = false;
  await prisma.$executeRawUnsafe(
    `INSERT INTO listing_agreements (id, property_id, seller_id, tier, commission_percent, buyer_agent_share_percent, protection_period_days, status, created_at, updated_at)
     VALUES ('mkt_bad_agr', 'mkt_prop_l1', 'mkt_seller_aigul', 'BASIC', 2, 50, 90, 'ACTIVE', now(), now())`,
  ).catch(() => { dupAgreement = true; });
  check('второй активный договор на объект отвергается базой', dupAgreement);

  console.log('\nСпор');
  const dispute = await prisma.listingExit.findUnique({ where: { id: 'mkt_exit_1' } });
  check('продажа мимо площадки покрытому покупателю открыла спор', dispute?.disputeOpened === true);
  check('телефон покупателя в записи не хранится', !JSON.stringify(dispute).includes('7051110004'));

  // Убираем за собой то, что создали для проверки.
  await prisma.secondaryFixation.deleteMany({ where: { buyerId: 'mkt_check_dup_buyer' } });
  await prisma.buyer.deleteMany({ where: { id: 'mkt_check_dup_buyer' } });
  await prisma.commission.deleteMany({ where: { id: 'mkt_bad' } });
  await prisma.listingAgreement.deleteMany({ where: { id: 'mkt_bad_agr' } });

  console.log(failures === 0 ? '\nВсе проверки пройдены.\n' : `\nПровалено проверок: ${failures}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
