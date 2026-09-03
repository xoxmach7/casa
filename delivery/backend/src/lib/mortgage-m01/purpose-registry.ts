/**
 * M01 §8 — реестр целей обработки (purpose registry).
 *
 * ЗАЧЕМ: до этого M01 хардкодил `purposeCode === 'mortgage_prescore'`, а M02
 * требовал `mortgage_preanalysis_official_registry_checks`. У ревизии согласия
 * код цели ОДИН, поэтому одно согласие физически не могло удовлетворить оба
 * гейта — сквозной путь был непроходим. Реестр снимает конфликт: цель
 * проверяется по утверждённому списку, а конкретное действие — по
 * `allowedOperations` самой ревизии.
 *
 * ПРАВИЛО СПЕКИ: неизвестная или отключённая цель → deny (никаких допущений).
 * Цели, ожидающие юридического решения, объявлены здесь как DISABLED — они
 * видимы, но согласие на них не открывает действий (RG-03 пенсии,
 * RG-CP-02 ручные финансовые данные).
 */

export type PurposeState = 'APPROVED' | 'DISABLED';

export interface PurposeDefinition {
  code: string;
  state: PurposeState;
  module: 'M01' | 'M02' | 'M03' | 'M04' | 'M05';
  /** Человеческое описание — для UI и аудита. */
  title: string;
  /** Почему отключена (если DISABLED) — гейт. */
  blockedBy?: string;
}

/** Действия, встречающиеся в гейтах M01. Список закрытый. */
export const MORTGAGE_OPERATIONS = [
  'collect_and_process_questionnaire_data',
  'calculate_preliminary_mortgage_options',
  'official_registry_checks',
  'upload_credit_report',
  'upload_pension_document',
] as const;
export type MortgageOperation = (typeof MORTGAGE_OPERATIONS)[number];

export const PURPOSE_REGISTRY_VERSION = 'casa.m01.purpose-registry/1.0.0';

const PURPOSES: PurposeDefinition[] = [
  // --- Утверждённые (M01 §8) ---
  {
    code: 'mortgage_preanalysis_official_registry_checks',
    state: 'APPROVED', module: 'M02',
    title: 'Предварительная проверка по официальным реестрам',
  },
  { code: 'credit_report_upload', state: 'APPROVED', module: 'M03', title: 'Загрузка кредитного отчёта' },
  { code: 'credit_report_extraction', state: 'APPROVED', module: 'M03', title: 'Извлечение данных кредитного отчёта' },
  { code: 'credit_history_analysis', state: 'APPROVED', module: 'M03', title: 'Анализ кредитной истории' },
  { code: 'internal_snapshot_use', state: 'APPROVED', module: 'M03', title: 'Внутреннее использование снимка' },

  // --- Ожидают юридического решения: объявлены, но действий не открывают ---
  {
    code: 'pension_contribution_processing',
    state: 'DISABLED', module: 'M04',
    title: 'Обработка выписки о пенсионных взносах',
    blockedBy: 'RG-03 (pension purposes) — Legal/Product',
  },
  {
    code: 'manual_financial_data',
    state: 'DISABLED', module: 'M05',
    title: 'Ручной ввод финансовых данных клиента',
    blockedBy: 'RG-CP-02 — Product/Legal',
  },

  /**
   * LEGACY. В утверждённом перечне §8 этого кода НЕТ. Оставлен временно, чтобы
   * ранее выданные согласия и существующие данные продолжали работать.
   * Мигрировать на `mortgage_preanalysis_official_registry_checks`.
   */
  {
    code: 'mortgage_prescore',
    state: 'APPROVED', module: 'M01',
    title: 'Предварительный ипотечный анализ (legacy, вне §8)',
  },
];

const BY_CODE = new Map(PURPOSES.map((p) => [p.code, p]));

export function listPurposes(): PurposeDefinition[] {
  return PURPOSES.map((p) => ({ ...p }));
}

export function findPurpose(code: string): PurposeDefinition | null {
  return BY_CODE.get(code) ?? null;
}

/** Цель существует в реестре И утверждена. Неизвестная/отключённая → false. */
export function isPurposeApproved(code: string): boolean {
  return findPurpose(code)?.state === 'APPROVED';
}

/** Разрешено ли действие: цель утверждена и операция входит в закрытый список. */
export function isKnownOperation(operation: string): operation is MortgageOperation {
  return (MORTGAGE_OPERATIONS as readonly string[]).includes(operation);
}
