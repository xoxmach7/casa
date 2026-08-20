/**
 * Движок demo-режима «ипотечного рабочего экрана» CASA Pro Ипотека.
 *
 * ЧИСТАЯ ЛОГИКА без побочных эффектов и без обращения к БД. Все значения —
 * демонстрационные (demo_only): банковские условия, ставки, платежи и квартиры
 * требуют проверки перед production. Расчёты опираются на Decimal-safe
 * примитивы из mortgage-financial.service.ts; наружу отдаём округлённые number
 * (тенге — целые, КДН — проценты с 1 знаком).
 *
 * Демо-данные зеркалят фронтенд (frontend/lib/mortgage/mock.ts + calc.ts) 1:1.
 */

import { annuityPayment, kdnAfter } from '../mortgage-financial.service';

// --- Что-если: live-пересчёт ------------------------------------------------

export interface WhatIfInput {
  propertyPrice: number;
  downPayment: number;
  termMonths: number;
  rate: number;
  existingDebtPayment: number;
  additionalConfirmedIncome: number;
  baseIncome: number;
}

export interface WhatIfResult {
  loanAmount: number;
  monthlyPayment: number;
  kdn: number;
  acceptedIncome: number;
  eligibleProgramsCount: number;
}

/**
 * Демо-порог КДН для подсветки. НЕ банковское правило — реальный предел
 * приходит из версии программы. Здесь только чтобы показать «сколько программ
 * открылось» на моке (зеркало DEMO_KDN_LIMIT из frontend/lib/mortgage/calc.ts).
 */
export const DEMO_KDN_LIMIT = 50;

/**
 * Live-пересчёт секции «Что если». Логика ровно как recalcWhatIf в calc.ts:
 * сумма кредита = цена − взнос, аннуитетный платёж, КДН = (существующие
 * платежи + новый платёж) / принимаемый доход, и демонстрационная связь
 * КДН → число открытых программ (≤35→4, ≤45→3, ≤50→1, иначе 0).
 */
export function computeWhatIf(input: WhatIfInput): WhatIfResult {
  const principal = Math.max(0, input.propertyPrice - input.downPayment);
  const acceptedIncome = input.baseIncome + Math.max(0, input.additionalConfirmedIncome);

  // Аннуитет через Decimal-safe примитив. periodicRate = годовая%/100/12.
  let monthlyPayment = 0;
  if (principal > 0 && input.termMonths > 0) {
    const periodicRate = input.rate / 100 / 12;
    monthlyPayment = annuityPayment(principal, periodicRate, input.termMonths).toNumber();
  }

  // КДН в процентах. kdnAfter возвращает долю (0..1), домножаем на 100.
  let kdn = 0;
  if (acceptedIncome > 0) {
    kdn = kdnAfter(input.existingDebtPayment, monthlyPayment, acceptedIncome).toNumber() * 100;
  }

  // Демонстрационная связь КДН → число открытых программ (мок).
  let eligibleProgramsCount = 0;
  if (kdn <= 35) eligibleProgramsCount = 4;
  else if (kdn <= 45) eligibleProgramsCount = 3;
  else if (kdn <= DEMO_KDN_LIMIT) eligibleProgramsCount = 1;
  else eligibleProgramsCount = 0;

  return {
    loanAmount: Math.round(principal),
    monthlyPayment: Math.round(monthlyPayment),
    kdn: Math.round(kdn * 10) / 10,
    acceptedIncome: Math.round(acceptedIncome),
    eligibleProgramsCount,
  };
}

// --- Демо-константы клиента (зеркало DEMO_CLIENT) ---------------------------

/** Базовый принимаемый доход демо-клиента «Айдос Мухамедов», ₸/мес. */
export const DEMO_BASE_INCOME = 650000;
/** Существующие ежемесячные обязательства демо-клиента, ₸/мес. */
export const DEMO_EXISTING_PAYMENT = 115000;

// --- Анализ: вердикты программ (зеркало buildDemoAnalysis) ------------------

export function demoAnalysis() {
  const acceptedIncome = DEMO_BASE_INCOME;
  const existingPayment = DEMO_EXISTING_PAYMENT;
  // 30 млн − 5 млн взнос = 25 млн, ставка 18,5%, срок 240 мес.
  const proposedPayment = Math.round(annuityPayment(25000000, 18.5 / 100 / 12, 240).toNumber());
  const currentKdn = ((existingPayment + proposedPayment) / acceptedIncome) * 100;
  const kdnRounded = Math.round(currentKdn * 10) / 10;

  return {
    analysisId: 'an-demo-1',
    engineVersion: 'mock-0.1',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    acceptedIncome,
    proposedPayment,
    currentKdn,
    missingData: ['Подтверждённая ставка для рефинансирования потребкредита (для сценария 2)'],
    blockingFactors: ['Долговая нагрузка выше комфортного порога стартового набора программ'],
    programResults: [
      {
        programId: 'pr-7-20-25',
        bank: 'Отбасы банк',
        programName: '7-20-25',
        verdict: 'not_eligible',
        freshness: 'officially_verified',
        verifiedAt: '2026-08-12',
        rate: 7,
        estimatedPayment: proposedPayment,
        estimatedKdn: kdnRounded,
        blockingReasons: [
          'Текущая долговая нагрузка превышает предел программы',
          'Требуется снизить существующие платежи или увеличить взнос',
        ],
        rules: [
          {
            ruleId: 'kdn-limit',
            status: 'fail',
            humanReason: 'КДН выше предела программы',
            actualValue: `${Math.round(currentKdn)}%`,
            requiredValue: '≤ 45%',
            remediation: 'Рефинансировать потребкредит или частично погасить долг',
            sourceReference: 'Правила программы 7-20-25, ред. 08.2026',
          },
          {
            ruleId: 'down-payment',
            status: 'pass',
            humanReason: 'Первоначальный взнос достаточен',
            actualValue: '16,7%',
            requiredValue: '≥ 10%',
          },
        ],
      },
      {
        programId: 'pr-baspana-hit',
        bank: 'Отбасы банк',
        programName: 'Баспана Хит',
        verdict: 'potentially_eligible',
        freshness: 'bank_confirmed',
        verifiedAt: '2026-08-05',
        rate: 12.5,
        estimatedPayment: proposedPayment,
        estimatedKdn: kdnRounded,
        blockingReasons: ['Условно: пройдёт после снижения долговой нагрузки на ~40 тыс ₸/мес'],
        rules: [
          {
            ruleId: 'kdn-limit',
            status: 'manual',
            humanReason: 'КДН близок к пределу — требует подтверждения банком',
            actualValue: `${Math.round(currentKdn)}%`,
            requiredValue: '≤ 50%',
            remediation: 'Подтвердить дополнительный доход или снизить платежи',
          },
        ],
      },
      {
        programId: 'pr-commercial',
        bank: 'Bereke Bank',
        programName: 'Рыночная ипотека',
        verdict: 'manual_bank_confirmation_required',
        freshness: 'stale_requires_review',
        verifiedAt: '2026-07-20',
        rate: 20.9,
        estimatedPayment: proposedPayment,
        estimatedKdn: kdnRounded,
        blockingReasons: [
          'Версия правил устарела (проверена 20.07.2026) — зелёный результат заблокирован до обновления',
        ],
        rules: [
          {
            ruleId: 'freshness',
            status: 'unknown',
            humanReason: 'Правила программы устарели, требуется повторная проверка источника',
            sourceReference: 'Публикация банка от 20.07.2026',
          },
        ],
      },
      {
        programId: 'pr-nedostatok',
        bank: 'Home Credit',
        programName: 'Новостройка+',
        verdict: 'insufficient_data',
        freshness: 'observed_requires_confirmation',
        verifiedAt: '2026-08-01',
        rate: 16.9,
        estimatedPayment: undefined as number | undefined,
        estimatedKdn: undefined as number | undefined,
        blockingReasons: ['Недостаточно данных: не подтверждён тип занятости и стаж'],
        rules: [
          {
            ruleId: 'employment',
            status: 'unknown',
            humanReason: 'Не хватает подтверждения занятости',
            remediation: 'Добавить справку о доходах / трудовой договор',
          },
        ],
      },
    ],
  };
}

// --- Сценарии («Как провести клиента», зеркало buildDemoScenarios) ----------

export function demoScenarios() {
  return [
    {
      id: 'sc-refi',
      type: 'refinance_high_rate_debt',
      title: 'Рефинансировать дорогой потребкредит',
      summary: 'Снизить ставку по кредиту Kaspi 24,9% → открыть Баспана Хит.',
      rank: 1,
      requiresVerifiedInput: true,
      preliminary: true,
      monthlySaving: 26000,
      newKdn: 43,
      deltas: [
        { label: 'Платёж по потребкредиту', before: '78 000 ₸', after: '52 000 ₸', positive: true },
        { label: 'КДН', before: '48%', after: '43%', positive: true },
      ],
      openedPrograms: ['Баспана Хит'],
      requiredDocuments: ['Подтверждённое предложение о рефинансировании'],
      requiredActions: ['Ввести проверенную ставку и ГЭСВ рефинансирования'],
      scoreBreakdown: [
        { factor: 'Открывает программу', weight: 0.35, note: 'Открывает Баспана Хит' },
        { factor: 'Требуемые деньги', weight: 0.2, note: '0 ₸ наличными' },
        { factor: 'Снижение платежа', weight: 0.15, note: '−26 000 ₸/мес' },
      ],
    },
    {
      id: 'sc-prepay',
      type: 'partial_early_repayment',
      title: 'Частично погасить долг (уменьшить платёж)',
      summary: 'Внести 1 200 000 ₸ в счёт Kaspi с уменьшением ежемесячного платежа.',
      rank: 2,
      cashRequired: 1200000,
      monthlySaving: 34000,
      newKdn: 42,
      deltas: [
        { label: 'Остаток Kaspi', before: '2 600 000 ₸', after: '1 400 000 ₸', positive: true },
        { label: 'Платёж по кредиту', before: '78 000 ₸', after: '44 000 ₸', positive: true },
        { label: 'КДН', before: '48%', after: '42%', positive: true },
      ],
      openedPrograms: ['Баспана Хит'],
      requiredDocuments: ['Новый график платежей от банка'],
      requiredActions: ['Выбран режим «уменьшение платежа»', 'Получить обновлённый график'],
      scoreBreakdown: [
        { factor: 'Открывает программу', weight: 0.35, note: 'Открывает Баспана Хит' },
        { factor: 'Требуемые деньги', weight: 0.2, note: '1,2 млн ₸ наличными' },
      ],
    },
    {
      id: 'sc-income',
      type: 'increase_confirmed_income',
      title: 'Подтвердить дополнительный доход',
      summary: 'Добавить 120 000 ₸ дохода супруги с официальным подтверждением.',
      rank: 3,
      newKdn: 40,
      deltas: [
        { label: 'Принимаемый доход', before: '650 000 ₸', after: '770 000 ₸', positive: true },
        { label: 'КДН', before: '48%', after: '40%', positive: true },
      ],
      openedPrograms: ['Баспана Хит', '7-20-25 (условно)'],
      requiredDocuments: ['Справка о доходах супруги', 'Согласие созаёмщика'],
      requiredActions: ['Проверить, принимает ли программа этот тип подтверждения'],
      scoreBreakdown: [
        { factor: 'Открывает программу', weight: 0.35, note: 'Открывает 2 программы' },
        { factor: 'Сложность документов', weight: 0.05, note: 'Нужны 2 документа' },
      ],
    },
    {
      id: 'sc-downpay',
      type: 'increase_down_payment',
      title: 'Увеличить первоначальный взнос',
      summary: 'Довнести 2 000 000 ₸ взноса — снизить сумму кредита и платёж.',
      rank: 4,
      cashRequired: 2000000,
      newKdn: 41,
      deltas: [
        { label: 'Взнос', before: '5 000 000 ₸', after: '7 000 000 ₸', positive: true },
        { label: 'Сумма кредита', before: '25 000 000 ₸', after: '23 000 000 ₸', positive: true },
        { label: 'КДН', before: '48%', after: '41%', positive: true },
      ],
      openedPrograms: ['Баспана Хит'],
      requiredDocuments: ['Подтверждение источника взноса'],
      requiredActions: [],
      scoreBreakdown: [{ factor: 'Требуемые деньги', weight: 0.2, note: '2 млн ₸ наличными' }],
    },
    {
      id: 'sc-budget',
      type: 'lower_property_budget',
      title: 'Снизить бюджет квартиры',
      summary: 'Рассмотреть квартиры до 26 000 000 ₸ вместо 30 000 000 ₸.',
      rank: 5,
      newKdn: 40,
      deltas: [
        { label: 'Стоимость квартиры', before: '30 000 000 ₸', after: '26 000 000 ₸', positive: true },
        { label: 'Платёж по ипотеке', before: '≈ 205 000 ₸', after: '≈ 172 000 ₸', positive: true },
        { label: 'КДН', before: '48%', after: '40%', positive: true },
      ],
      openedPrograms: ['Баспана Хит'],
      requiredDocuments: [],
      requiredActions: ['Пересобрать подбор новостроек под новый бюджет'],
      scoreBreakdown: [{ factor: 'Открывает программу', weight: 0.35, note: 'Открывает Баспана Хит' }],
    },
    {
      id: 'sc-coborrower',
      type: 'add_co_borrower',
      title: 'Добавить созаёмщика',
      summary: 'Присоединить супругу как созаёмщика — объединить доход.',
      rank: 6,
      newKdn: 38,
      deltas: [
        { label: 'Совокупный доход', before: '650 000 ₸', after: '1 010 000 ₸', positive: true },
        { label: 'КДН', before: '48%', after: '38%', positive: true },
      ],
      openedPrograms: ['Баспана Хит', '7-20-25 (условно)'],
      requiredDocuments: ['Документы созаёмщика', 'Согласие созаёмщика'],
      requiredActions: ['Создать снимок созаёмщика'],
      scoreBreakdown: [{ factor: 'Открывает программу', weight: 0.35, note: 'Открывает 2 программы' }],
    },
  ];
}

// --- Подбор квартир в новостройках (зеркало buildDemoProperties) ------------

export function demoProperties() {
  return [
    {
      id: 'pm-1',
      developmentName: 'ЖК «Алматы Тауэрс»',
      developerName: 'BI Group',
      city: 'Алматы',
      address: 'ул. Розыбакиева, 247',
      rooms: 2,
      areaSqm: 58,
      floor: 9,
      completionDate: 'IV кв. 2026',
      price: 25500000,
      minimumDownPayment: 3825000,
      estimatedLoanAmount: 20500000,
      estimatedMonthlyPayment: 172000,
      estimatedKdn: 42,
      fit: 'fits_after_selected_scenario',
      fitReasons: ['Проходит после выбранного сценария рефинансирования'],
      warnings: ['Демо-данные: цену и наличие подтвердить у застройщика'],
      availabilityCheckedAt: '2026-08-19',
      accreditationCheckedAt: '2026-08-15',
      demo: true,
    },
    {
      id: 'pm-2',
      developmentName: 'ЖК «Есиль Парк»',
      developerName: 'Bazis-A',
      city: 'Алматы',
      address: 'мкр. Нурлытау, 12',
      rooms: 2,
      areaSqm: 62,
      floor: 5,
      completionDate: 'II кв. 2027',
      price: 24000000,
      minimumDownPayment: 3600000,
      estimatedLoanAmount: 19000000,
      estimatedMonthlyPayment: 159000,
      estimatedKdn: 40,
      fit: 'fits_now',
      fitReasons: ['Платёж в пределах комфортного', 'Аккредитован в Отбасы банк'],
      warnings: ['Демо-данные'],
      availabilityCheckedAt: '2026-08-19',
      accreditationCheckedAt: '2026-08-18',
      demo: true,
    },
    {
      id: 'pm-3',
      developmentName: 'ЖК « Горный квартал»',
      developerName: 'Sensata',
      city: 'Алматы',
      address: 'ул. Аль-Фараби, 140',
      rooms: 3,
      areaSqm: 84,
      floor: 12,
      completionDate: 'сдан',
      price: 34500000,
      minimumDownPayment: 5175000,
      estimatedLoanAmount: 29500000,
      estimatedMonthlyPayment: 247000,
      estimatedKdn: 56,
      fit: 'does_not_fit',
      fitReasons: ['Платёж и КДН выше порога даже после сценария'],
      warnings: ['Демо-данные'],
      availabilityCheckedAt: '2026-08-19',
      accreditationCheckedAt: '2026-08-10',
      demo: true,
    },
    {
      id: 'pm-4',
      developmentName: 'ЖК «Северное сияние»',
      developerName: 'Global Build',
      city: 'Алматы',
      address: 'пр. Райымбека, 480',
      rooms: 1,
      areaSqm: 42,
      floor: 7,
      completionDate: 'III кв. 2026',
      price: 19500000,
      minimumDownPayment: 2925000,
      estimatedLoanAmount: 15000000,
      estimatedMonthlyPayment: 126000,
      estimatedKdn: 38,
      fit: 'accreditation_check_required',
      fitReasons: ['Финансово подходит'],
      warnings: ['Требуется проверка аккредитации банка', 'Демо-данные'],
      availabilityCheckedAt: '2026-08-12',
      accreditationCheckedAt: '2026-07-30',
      demo: true,
    },
  ];
}

// --- Безопасное клиентское заключение (AC-014) ------------------------------

export interface ConclusionInput {
  token: string;
  createdAt: string;
  expiresAt: string;
  /** Только имя для показа клиенту — без ИИН/телефона. */
  displayName?: string;
  whatIf: WhatIfInput;
  selectedScenarioId?: string | null;
  /** Идентификаторы выбранных квартир; пусто/не задано — берём весь подбор. */
  selectedPropertyIds?: string[];
}

export interface ConclusionPayload {
  token: string;
  version: number;
  createdAt: string;
  expiresAt: string;
  demo: true;
  client: { displayName: string };
  summary: {
    propertyPrice: number;
    downPayment: number;
    loanAmount: number;
    monthlyPayment: number;
    kdn: number;
    rate: number;
    termMonths: number;
    acceptedIncome: number;
  };
  selectedScenario:
    | {
        title: string;
        summary: string;
        deltas: { label: string; before: string; after: string }[];
        monthlySaving?: number;
        cashRequired?: number;
      }
    | null;
  programs: { programName: string; bank: string; rate: number; verdict: string; note: string }[];
  properties: {
    developmentName: string;
    address: string;
    rooms: number;
    area: number;
    price: number;
    monthlyPayment: number;
    fit: string;
  }[];
  pros: string[];
  limitations: string[];
  nextSteps: string[];
}

/**
 * Собирает «безопасное клиентское заключение»: только те поля, которые можно
 * показать клиенту по публичной ссылке. НАМЕРЕННО без ИИН, без документов и без
 * внутренних заметок (AC-014). Расчёт сводки — через computeWhatIf.
 */
export function buildConclusionPayload(input: ConclusionInput): ConclusionPayload {
  const calc = computeWhatIf(input.whatIf);

  // Выбранный сценарий → безопасная краткая форма (заголовок, суть, дельты).
  let selectedScenario: ConclusionPayload['selectedScenario'] = null;
  if (input.selectedScenarioId) {
    const found = demoScenarios().find((s) => s.id === input.selectedScenarioId);
    if (found) {
      selectedScenario = {
        title: found.title,
        summary: found.summary,
        deltas: found.deltas.map((d) => ({ label: d.label, before: d.before, after: d.after })),
        ...(found.monthlySaving !== undefined ? { monthlySaving: found.monthlySaving } : {}),
        ...(found.cashRequired !== undefined ? { cashRequired: found.cashRequired } : {}),
      };
    }
  }

  // Программы → только клиентские поля вердикта (без внутренних правил/источников).
  const programs = demoAnalysis().programResults.map((p) => ({
    programName: p.programName,
    bank: p.bank,
    rate: p.rate,
    verdict: p.verdict,
    note: p.blockingReasons[0] ?? 'Предварительно — требует подтверждения банком',
  }));

  // Квартиры → только карточные поля; фильтр по выбранным, если заданы.
  const ids = input.selectedPropertyIds;
  const properties = demoProperties()
    .filter((pm) => !ids || ids.length === 0 || ids.includes(pm.id))
    .map((pm) => ({
      developmentName: pm.developmentName,
      address: pm.address,
      rooms: pm.rooms,
      area: pm.areaSqm,
      price: pm.price,
      monthlyPayment: pm.estimatedMonthlyPayment,
      fit: pm.fit,
    }));

  return {
    token: input.token,
    version: 1,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    demo: true,
    client: { displayName: input.displayName?.trim() || 'Клиент' },
    summary: {
      propertyPrice: input.whatIf.propertyPrice,
      downPayment: input.whatIf.downPayment,
      loanAmount: calc.loanAmount,
      monthlyPayment: calc.monthlyPayment,
      kdn: calc.kdn,
      rate: input.whatIf.rate,
      termMonths: input.whatIf.termMonths,
      acceptedIncome: calc.acceptedIncome,
    },
    selectedScenario,
    programs,
    properties,
    pros: [
      'Первоначальный взнос покрывает минимальный порог рассмотренных программ',
      'Подобраны квартиры в аккредитованных новостройках под ваш бюджет',
      'Есть рабочий сценарий, снижающий долговую нагрузку и КДН',
    ],
    limitations: [
      'Расчёт предварительный: итоговое решение принимает банк',
      'Часть условий и ставок требует подтверждения из первоисточника',
      'Демо-данные по квартирам — цену и наличие уточняйте у застройщика',
    ],
    nextSteps: [
      'Подтвердить дополнительный доход или условия рефинансирования',
      'Согласовать с банком выбранную программу и график платежей',
      'Проверить аккредитацию выбранной новостройки',
    ],
  };
}
