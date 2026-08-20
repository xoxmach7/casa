/**
 * Демонстрационные данные CASA Pro Ипотека (demo_fixture в ТЗ).
 *
 * demo_only: true. Все банковские условия, ставки, платежи и квартиры —
 * демонстрационные и требуют проверки перед production. Данные существуют
 * только чтобы сделать кликабельными все интерактивные состояния Phase 0.
 */

import type {
  MortgageClient,
  ClientDocument,
  LoanObligation,
  AnalysisResult,
  MortgageScenario,
  PropertyMatch,
  WorkspaceState,
  WhatIfInputs,
} from "./types";
import { annuityPayment, preliminaryKdn } from "./calc";

// --- Клиенты для селектора --------------------------------------------------

export const MOCK_CLIENTS: MortgageClient[] = [
  {
    id: "cl-aidos",
    fullName: "Айдос Мухамедов",
    phone: "+7 701 555 20 31",
    iinMasked: "9203••••••31",
    city: "Алматы",
    age: 31,
    confirmedIncome: 650000,
    existingMonthlyPayment: 115000,
    outstandingDebt: 4200000,
    downPayment: 5000000,
    desiredPropertyPrice: 30000000,
    comfortableMonthlyPayment: 240000,
    desiredTermMonths: 240,
    pensionStability: "stable",
  },
  {
    id: "cl-dana",
    fullName: "Дана Сериккызы",
    phone: "+7 707 318 44 09",
    iinMasked: "9511••••••44",
    city: "Астана",
    age: 29,
    confirmedIncome: 480000,
    existingMonthlyPayment: 0,
    outstandingDebt: 0,
    downPayment: 8000000,
    desiredPropertyPrice: 26000000,
    comfortableMonthlyPayment: 200000,
    desiredTermMonths: 240,
    pensionStability: "stable",
  },
  {
    id: "cl-marat",
    fullName: "Марат Оспанов",
    phone: "+7 708 902 11 77",
    iinMasked: "8807••••••17",
    city: "Шымкент",
    age: 38,
    confirmedIncome: 720000,
    existingMonthlyPayment: 240000,
    outstandingDebt: 9800000,
    downPayment: 3000000,
    desiredPropertyPrice: 34000000,
    comfortableMonthlyPayment: 260000,
    desiredTermMonths: 300,
    pensionStability: "gaps",
  },
];

export const DEMO_CLIENT = MOCK_CLIENTS[0];

// --- Документы демо-клиента (в исходном «пустом» состоянии) ------------------

export function makeCreditHistoryDoc(): ClientDocument {
  return {
    id: "doc-credit",
    type: "credit_history",
    title: "Кредитная история (ПКБ)",
    required: true,
    status: "missing",
    fields: [],
  };
}

export function makeEnpfDoc(): ClientDocument {
  return {
    id: "doc-enpf",
    type: "enpf_statement",
    title: "Выписка ЕНПФ",
    required: true,
    status: "missing",
    fields: [],
  };
}

/** Распознанные поля кредитной истории после «обработки». */
export const CREDIT_HISTORY_FIELDS: ClientDocument["fields"] = [
  { key: "report_date", label: "Дата отчёта", value: "12.08.2026", confidence: 0.99, page: 1, confirmed: false },
  { key: "report_source", label: "Источник", value: "Первое кредитное бюро", confidence: 0.98, page: 1, confirmed: false },
  { key: "active_loans", label: "Активных займов", value: 2, confidence: 0.97, page: 2, confirmed: false },
  { key: "monthly_payments", label: "Ежемесячные платежи, ₸", value: 115000, confidence: 0.93, page: 2, confirmed: false },
  { key: "outstanding_balances", label: "Остаток задолженности, ₸", value: 4200000, confidence: 0.9, page: 2, confirmed: false },
  {
    key: "days_past_due",
    label: "Макс. просрочка, дней",
    value: 12,
    confidence: 0.62,
    page: 3,
    confirmed: false,
    inconsistency: "Низкая уверенность: значение на скане нечёткое — подтвердите вручную.",
  },
];

/** Распознанные поля выписки ЕНПФ после «обработки». */
export const ENPF_FIELDS: ClientDocument["fields"] = [
  { key: "statement_period", label: "Период выписки", value: "08.2025 – 08.2026", confidence: 0.99, page: 1, confirmed: false },
  { key: "contribution_months", label: "Месяцев с отчислениями", value: 12, confidence: 0.98, page: 1, confirmed: false },
  { key: "monthly_opv", label: "Среднее ОПВ в мес., ₸", value: 65000, confidence: 0.96, page: 1, confirmed: false },
  { key: "employer_names", label: "Работодатель", value: "ТОО «Логистик Партнёр»", confidence: 0.94, page: 2, confirmed: false },
  { key: "gaps", label: "Пропуски отчислений", value: "нет", confidence: 0.91, page: 2, confirmed: false },
  { key: "latest_contribution", label: "Последнее отчисление", value: "08.2026", confidence: 0.97, page: 2, confirmed: false },
];

// --- Обязательства ----------------------------------------------------------

export const MOCK_OBLIGATIONS: LoanObligation[] = [
  {
    id: "ob-1",
    creditor: "Kaspi Bank",
    productType: "Потребительский кредит",
    outstandingBalance: 2600000,
    annualRate: 24.9,
    monthlyPayment: 78000,
    remainingTermMonths: 41,
    delinquencyStatus: "none",
    confidence: 0.92,
  },
  {
    id: "ob-2",
    creditor: "Halyk Bank",
    productType: "Рассрочка / карта",
    outstandingBalance: 1600000,
    annualRate: 19.5,
    monthlyPayment: 37000,
    remainingTermMonths: 48,
    delinquencyStatus: "none",
    confidence: 0.9,
  },
];

// --- Анализ: вердикты программ ----------------------------------------------

export function buildDemoAnalysis(): AnalysisResult {
  const acceptedIncome = 650000;
  const existingPayment = 115000;
  const proposedPayment = Math.round(annuityPayment(25000000, 18.5, 240)); // 30 млн − 5 млн взнос
  const currentKdn = preliminaryKdn(existingPayment, proposedPayment, acceptedIncome);

  return {
    analysisId: "an-demo-1",
    engineVersion: "mock-0.1",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    acceptedIncome,
    proposedPayment,
    currentKdn,
    missingData: ["Подтверждённая ставка для рефинансирования потребкредита (для сценария 2)"],
    blockingFactors: [
      "Долговая нагрузка выше комфортного порога стартового набора программ",
    ],
    programResults: [
      {
        programId: "pr-7-20-25",
        bank: "Отбасы банк",
        programName: "7-20-25",
        verdict: "not_eligible",
        freshness: "officially_verified",
        verifiedAt: "2026-08-12",
        rate: 7,
        estimatedPayment: proposedPayment,
        estimatedKdn: Math.round(currentKdn * 10) / 10,
        blockingReasons: [
          "Текущая долговая нагрузка превышает предел программы",
          "Требуется снизить существующие платежи или увеличить взнос",
        ],
        rules: [
          {
            ruleId: "kdn-limit",
            status: "fail",
            humanReason: "КДН выше предела программы",
            actualValue: `${Math.round(currentKdn)}%`,
            requiredValue: "≤ 45%",
            remediation: "Рефинансировать потребкредит или частично погасить долг",
            sourceReference: "Правила программы 7-20-25, ред. 08.2026",
          },
          {
            ruleId: "down-payment",
            status: "pass",
            humanReason: "Первоначальный взнос достаточен",
            actualValue: "16,7%",
            requiredValue: "≥ 10%",
          },
        ],
      },
      {
        programId: "pr-baspana-hit",
        bank: "Отбасы банк",
        programName: "Баспана Хит",
        verdict: "potentially_eligible",
        freshness: "bank_confirmed",
        verifiedAt: "2026-08-05",
        rate: 12.5,
        estimatedPayment: proposedPayment,
        estimatedKdn: Math.round(currentKdn * 10) / 10,
        blockingReasons: ["Условно: пройдёт после снижения долговой нагрузки на ~40 тыс ₸/мес"],
        rules: [
          {
            ruleId: "kdn-limit",
            status: "manual",
            humanReason: "КДН близок к пределу — требует подтверждения банком",
            actualValue: `${Math.round(currentKdn)}%`,
            requiredValue: "≤ 50%",
            remediation: "Подтвердить дополнительный доход или снизить платежи",
          },
        ],
      },
      {
        programId: "pr-commercial",
        bank: "Bereke Bank",
        programName: "Рыночная ипотека",
        verdict: "manual_bank_confirmation_required",
        freshness: "stale_requires_review",
        verifiedAt: "2026-07-20",
        rate: 20.9,
        estimatedPayment: proposedPayment,
        estimatedKdn: Math.round(currentKdn * 10) / 10,
        blockingReasons: [
          "Версия правил устарела (проверена 20.07.2026) — зелёный результат заблокирован до обновления",
        ],
        rules: [
          {
            ruleId: "freshness",
            status: "unknown",
            humanReason: "Правила программы устарели, требуется повторная проверка источника",
            sourceReference: "Публикация банка от 20.07.2026",
          },
        ],
      },
      {
        programId: "pr-nedostatok",
        bank: "Home Credit",
        programName: "Новостройка+",
        verdict: "insufficient_data",
        freshness: "observed_requires_confirmation",
        verifiedAt: "2026-08-01",
        rate: 16.9,
        blockingReasons: ["Недостаточно данных: не подтверждён тип занятости и стаж"],
        rules: [
          {
            ruleId: "employment",
            status: "unknown",
            humanReason: "Не хватает подтверждения занятости",
            remediation: "Добавить справку о доходах / трудовой договор",
          },
        ],
      },
    ],
  };
}

// --- Сценарии («Как провести клиента») --------------------------------------

export function buildDemoScenarios(): MortgageScenario[] {
  return [
    {
      id: "sc-refi",
      type: "refinance_high_rate_debt",
      title: "Рефинансировать дорогой потребкредит",
      summary: "Снизить ставку по кредиту Kaspi 24,9% → открыть Баспана Хит.",
      rank: 1,
      requiresVerifiedInput: true,
      preliminary: true,
      monthlySaving: 26000,
      newKdn: 43,
      deltas: [
        { label: "Платёж по потребкредиту", before: "78 000 ₸", after: "52 000 ₸", positive: true },
        { label: "КДН", before: "48%", after: "43%", positive: true },
      ],
      openedPrograms: ["Баспана Хит"],
      requiredDocuments: ["Подтверждённое предложение о рефинансировании"],
      requiredActions: ["Ввести проверенную ставку и ГЭСВ рефинансирования"],
      scoreBreakdown: [
        { factor: "Открывает программу", weight: 0.35, note: "Открывает Баспана Хит" },
        { factor: "Требуемые деньги", weight: 0.2, note: "0 ₸ наличными" },
        { factor: "Снижение платежа", weight: 0.15, note: "−26 000 ₸/мес" },
      ],
    },
    {
      id: "sc-prepay",
      type: "partial_early_repayment",
      title: "Частично погасить долг (уменьшить платёж)",
      summary: "Внести 1 200 000 ₸ в счёт Kaspi с уменьшением ежемесячного платежа.",
      rank: 2,
      cashRequired: 1200000,
      monthlySaving: 34000,
      newKdn: 42,
      deltas: [
        { label: "Остаток Kaspi", before: "2 600 000 ₸", after: "1 400 000 ₸", positive: true },
        { label: "Платёж по кредиту", before: "78 000 ₸", after: "44 000 ₸", positive: true },
        { label: "КДН", before: "48%", after: "42%", positive: true },
      ],
      openedPrograms: ["Баспана Хит"],
      requiredDocuments: ["Новый график платежей от банка"],
      requiredActions: ["Выбран режим «уменьшение платежа»", "Получить обновлённый график"],
      scoreBreakdown: [
        { factor: "Открывает программу", weight: 0.35, note: "Открывает Баспана Хит" },
        { factor: "Требуемые деньги", weight: 0.2, note: "1,2 млн ₸ наличными" },
      ],
    },
    {
      id: "sc-income",
      type: "increase_confirmed_income",
      title: "Подтвердить дополнительный доход",
      summary: "Добавить 120 000 ₸ дохода супруги с официальным подтверждением.",
      rank: 3,
      newKdn: 40,
      deltas: [
        { label: "Принимаемый доход", before: "650 000 ₸", after: "770 000 ₸", positive: true },
        { label: "КДН", before: "48%", after: "40%", positive: true },
      ],
      openedPrograms: ["Баспана Хит", "7-20-25 (условно)"],
      requiredDocuments: ["Справка о доходах супруги", "Согласие созаёмщика"],
      requiredActions: ["Проверить, принимает ли программа этот тип подтверждения"],
      scoreBreakdown: [
        { factor: "Открывает программу", weight: 0.35, note: "Открывает 2 программы" },
        { factor: "Сложность документов", weight: 0.05, note: "Нужны 2 документа" },
      ],
    },
    {
      id: "sc-downpay",
      type: "increase_down_payment",
      title: "Увеличить первоначальный взнос",
      summary: "Довнести 2 000 000 ₸ взноса — снизить сумму кредита и платёж.",
      rank: 4,
      cashRequired: 2000000,
      newKdn: 41,
      deltas: [
        { label: "Взнос", before: "5 000 000 ₸", after: "7 000 000 ₸", positive: true },
        { label: "Сумма кредита", before: "25 000 000 ₸", after: "23 000 000 ₸", positive: true },
        { label: "КДН", before: "48%", after: "41%", positive: true },
      ],
      openedPrograms: ["Баспана Хит"],
      requiredDocuments: ["Подтверждение источника взноса"],
      requiredActions: [],
      scoreBreakdown: [{ factor: "Требуемые деньги", weight: 0.2, note: "2 млн ₸ наличными" }],
    },
    {
      id: "sc-budget",
      type: "lower_property_budget",
      title: "Снизить бюджет квартиры",
      summary: "Рассмотреть квартиры до 26 000 000 ₸ вместо 30 000 000 ₸.",
      rank: 5,
      newKdn: 40,
      deltas: [
        { label: "Стоимость квартиры", before: "30 000 000 ₸", after: "26 000 000 ₸", positive: true },
        { label: "Платёж по ипотеке", before: "≈ 205 000 ₸", after: "≈ 172 000 ₸", positive: true },
        { label: "КДН", before: "48%", after: "40%", positive: true },
      ],
      openedPrograms: ["Баспана Хит"],
      requiredDocuments: [],
      requiredActions: ["Пересобрать подбор новостроек под новый бюджет"],
      scoreBreakdown: [{ factor: "Открывает программу", weight: 0.35, note: "Открывает Баспана Хит" }],
    },
    {
      id: "sc-coborrower",
      type: "add_co_borrower",
      title: "Добавить созаёмщика",
      summary: "Присоединить супругу как созаёмщика — объединить доход.",
      rank: 6,
      newKdn: 38,
      deltas: [
        { label: "Совокупный доход", before: "650 000 ₸", after: "1 010 000 ₸", positive: true },
        { label: "КДН", before: "48%", after: "38%", positive: true },
      ],
      openedPrograms: ["Баспана Хит", "7-20-25 (условно)"],
      requiredDocuments: ["Документы созаёмщика", "Согласие созаёмщика"],
      requiredActions: ["Создать снимок созаёмщика"],
      scoreBreakdown: [{ factor: "Открывает программу", weight: 0.35, note: "Открывает 2 программы" }],
    },
  ];
}

// --- Подбор квартир в новостройках ------------------------------------------

export function buildDemoProperties(): PropertyMatch[] {
  return [
    {
      id: "pm-1",
      developmentName: "ЖК «Алматы Тауэрс»",
      developerName: "BI Group",
      city: "Алматы",
      address: "ул. Розыбакиева, 247",
      rooms: 2,
      areaSqm: 58,
      floor: 9,
      completionDate: "IV кв. 2026",
      price: 25500000,
      minimumDownPayment: 3825000,
      estimatedLoanAmount: 20500000,
      estimatedMonthlyPayment: 172000,
      estimatedKdn: 42,
      fit: "fits_after_selected_scenario",
      fitReasons: ["Проходит после выбранного сценария рефинансирования"],
      warnings: ["Демо-данные: цену и наличие подтвердить у застройщика"],
      availabilityCheckedAt: "2026-08-19",
      accreditationCheckedAt: "2026-08-15",
      demo: true,
    },
    {
      id: "pm-2",
      developmentName: "ЖК «Есиль Парк»",
      developerName: "Bazis-A",
      city: "Алматы",
      address: "мкр. Нурлытау, 12",
      rooms: 2,
      areaSqm: 62,
      floor: 5,
      completionDate: "II кв. 2027",
      price: 24000000,
      minimumDownPayment: 3600000,
      estimatedLoanAmount: 19000000,
      estimatedMonthlyPayment: 159000,
      estimatedKdn: 40,
      fit: "fits_now",
      fitReasons: ["Платёж в пределах комфортного", "Аккредитован в Отбасы банк"],
      warnings: ["Демо-данные"],
      availabilityCheckedAt: "2026-08-19",
      accreditationCheckedAt: "2026-08-18",
      demo: true,
    },
    {
      id: "pm-3",
      developmentName: "ЖК « Горный квартал»",
      developerName: "Sensata",
      city: "Алматы",
      address: "ул. Аль-Фараби, 140",
      rooms: 3,
      areaSqm: 84,
      floor: 12,
      completionDate: "сдан",
      price: 34500000,
      minimumDownPayment: 5175000,
      estimatedLoanAmount: 29500000,
      estimatedMonthlyPayment: 247000,
      estimatedKdn: 56,
      fit: "does_not_fit",
      fitReasons: ["Платёж и КДН выше порога даже после сценария"],
      warnings: ["Демо-данные"],
      availabilityCheckedAt: "2026-08-19",
      accreditationCheckedAt: "2026-08-10",
      demo: true,
    },
    {
      id: "pm-4",
      developmentName: "ЖК «Северное сияние»",
      developerName: "Global Build",
      city: "Алматы",
      address: "пр. Райымбека, 480",
      rooms: 1,
      areaSqm: 42,
      floor: 7,
      completionDate: "III кв. 2026",
      price: 19500000,
      minimumDownPayment: 2925000,
      estimatedLoanAmount: 15000000,
      estimatedMonthlyPayment: 126000,
      estimatedKdn: 38,
      fit: "accreditation_check_required",
      fitReasons: ["Финансово подходит"],
      warnings: ["Требуется проверка аккредитации банка", "Демо-данные"],
      availabilityCheckedAt: "2026-08-12",
      accreditationCheckedAt: "2026-07-30",
      demo: true,
    },
  ];
}

// --- Начальное состояние рабочего экрана ------------------------------------

export const DEFAULT_WHAT_IF: WhatIfInputs = {
  propertyPrice: 30000000,
  downPayment: 5000000,
  termMonths: 240,
  existingDebtPayment: 115000,
  additionalConfirmedIncome: 0,
  rate: 12.5,
};

export function createInitialWorkspace(): WorkspaceState {
  return {
    caseStatus: "new",
    client: null,
    consent: {
      status: "not_requested",
      linkTtlMinutes: 30,
      otpTtlMinutes: 5,
    },
    documents: {
      creditHistory: makeCreditHistoryDoc(),
      enpf: makeEnpfDoc(),
    },
    iinCheck: { status: "not_started" },
    obligations: [],
    analysis: null,
    snapshotConfirmed: false,
    scenarios: [],
    selectedScenarioId: null,
    whatIf: { ...DEFAULT_WHAT_IF },
    properties: [],
    nextAction: null,
    conclusion: null,
    lastCalculationAt: null,
  };
}
