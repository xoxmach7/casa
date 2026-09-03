/**
 * Два уровня договора с собственником.
 *
 * Разница между ними экономическая, а не риторическая: эксклюзив должен быть
 * выгоден арифметически, иначе его никто не подпишет. На квартире за 30 млн
 * BASIC стоит собственнику 600 000 ₸, EXCLUSIVE — 450 000 ₸, и в EXCLUSIVE
 * входит оценка, юрчистота и подготовка документов.
 *
 * Цифры — рабочие допущения из раздела 9 спеки, НЕ утверждённый тариф.
 * Значения на конкретном договоре хранятся в самой записи ListingAgreement,
 * поэтому админ меняет условия точечно без релиза; здесь только умолчания.
 */

export type ListingTierName = 'BASIC' | 'EXCLUSIVE';

export interface TierTerms {
  /** Процент от цены сделки, который платит собственник. */
  commissionPercent: string;
  /** Доля агента покупателя внутри комиссии, в процентах. */
  buyerAgentSharePercent: string;
  /** Сколько дней после истечения фиксации сделка всё ещё порождает комиссию. */
  protectionPeriodDays: number;
  /** Сколько дней живёт сама фиксация. */
  fixationDays: number;
  /** Что входит в пакет — показывается собственнику в оферте. */
  includedServices: string[];
}

export const LISTING_TIERS: Record<ListingTierName, TierTerms> = {
  BASIC: {
    commissionPercent: '2.00',
    buyerAgentSharePercent: '50.00',
    protectionPeriodDays: 90,
    fixationDays: 30,
    includedServices: ['Размещение объекта', 'Приём заявок от агентов'],
  },
  EXCLUSIVE: {
    commissionPercent: '1.50',
    buyerAgentSharePercent: '50.00',
    protectionPeriodDays: 180,
    fixationDays: 45,
    includedServices: [
      'Размещение объекта',
      'Приём заявок от агентов',
      'Профессиональная оценка с аналогами',
      'Проверка юридической чистоты',
      'Подготовка документов к сделке',
      'Приоритет в выдаче',
    ],
  },
};

export function termsForTier(tier: ListingTierName): TierTerms {
  const terms = LISTING_TIERS[tier];
  if (!terms) throw new Error(`Неизвестный уровень договора: ${tier}`);
  return terms;
}
