/**
 * M06 Formula Registry — allowlist релиза 1.0.
 *
 * Источник: M06_CASA_Pro_Calculation_Engine_Production_Spec_v1.4 §8 Formula
 * Registry + M06_FORMULA_REGISTRY.csv. Значения перенесены, а не выведены.
 *
 * §21 requested_calculations: «Ordered formula IDs + versions; unknown/disabled
 * ID rejected safely». Поэтому реестр здесь — не справочник для UI, а сторож:
 * запрос на неизвестную или DISABLED формулу отклоняется, и ни при каких
 * условиях не исполняется молча «что-нибудь похожее».
 *
 * REG-F-001 (reg.kz.kdn.bank) присутствует НАМЕРЕННО со статусом DISABLED:
 * его нужно уметь распознать и осмысленно отвергнуть. Норматив — банковский
 * КДН №52 в редакции №92; правило 0.25 из №86 действует с 01.07.2027. Numeric
 * КДН в релизе 1.0 не считается: value=null, REGULATORY_INPUT_REQUIRED.
 */

export type FormulaStatus = 'APPROVED' | 'DISABLED';

export interface RegisteredFormula {
  formulaId: string;
  machineName: string;
  formulaVersion: string;
  origin: string;
  status: FormulaStatus;
  effectiveFrom: string;
}

export const M06_FORMULA_REGISTRY_VERSION = 'm06-registry/1.0.0';

export const M06_FORMULA_REGISTRY: readonly RegisteredFormula[] = [
  {
    formulaId: 'CALC-F-001',
    machineName: 'casa.required_financing',
    formulaVersion: '1.0.0',
    origin: 'CASA_NEUTRAL / M06_CASA_NEUTRAL_1_0',
    status: 'APPROVED',
    effectiveFrom: '2026-08-23',
  },
  {
    formulaId: 'CALC-F-002',
    machineName: 'casa.annuity_payment_by_parameters',
    formulaVersion: '1.0.0',
    origin: 'CASA_NEUTRAL / M06_CASA_NEUTRAL_1_0',
    status: 'APPROVED',
    effectiveFrom: '2026-08-23',
  },
  {
    formulaId: 'REG-F-001',
    machineName: 'reg.kz.kdn.bank',
    formulaVersion: '2025-52/2026-92',
    origin: 'REGULATORY_KZ / NBRK / Bank',
    status: 'DISABLED',
    effectiveFrom: '2026-08-18',
  },
] as const;

/**
 * Порядок значим: он попадает в run как requested_calculations и в replay
 * payload как formula_versions. Совпадает с §29.
 */
export const M06_RELEASE_1_0_ALLOWLIST: readonly string[] = [
  'CALC-F-001',
  'CALC-F-002',
] as const;

export interface RequestedCalculation extends Record<string, unknown> {
  formula_id: string;
  machine_name: string;
  formula_version: string;
  origin: string;
}

export class FormulaNotAllowedError extends Error {
  constructor(public readonly code: string, public readonly formulaId: string, message: string) {
    super(message);
    this.name = 'FormulaNotAllowedError';
  }
}

function find(formulaId: string): RegisteredFormula | undefined {
  return M06_FORMULA_REGISTRY.find((f) => f.formulaId === formulaId);
}

/**
 * Разрешает запрошенные формулы в точные записи реестра.
 *
 * Пустой/непереданный запрос → фиксированный allowlist релиза 1.0; но результат
 * всё равно возвращается развёрнутым, потому что run обязан сохранить ИМЕННО
 * выбранные id и версии, а не ссылку «по умолчанию».
 */
export function resolveRequestedCalculations(requested?: readonly string[] | null): RequestedCalculation[] {
  const ids = requested && requested.length > 0 ? requested : M06_RELEASE_1_0_ALLOWLIST;

  const seen = new Set<string>();
  return ids.map((formulaId) => {
    if (seen.has(formulaId)) {
      throw new FormulaNotAllowedError('DUPLICATE_FORMULA', formulaId, `Формула ${formulaId} запрошена дважды`);
    }
    seen.add(formulaId);

    const entry = find(formulaId);
    if (!entry) {
      throw new FormulaNotAllowedError('UNKNOWN_FORMULA', formulaId, `Неизвестная формула ${formulaId}`);
    }
    if (entry.status === 'DISABLED') {
      throw new FormulaNotAllowedError(
        'FORMULA_DISABLED',
        formulaId,
        `Формула ${formulaId} отключена в текущем релизе (REGULATORY_INPUT_REQUIRED)`,
      );
    }
    if (!M06_RELEASE_1_0_ALLOWLIST.includes(formulaId)) {
      throw new FormulaNotAllowedError(
        'FORMULA_NOT_IN_RELEASE',
        formulaId,
        `Формула ${formulaId} не входит в allowlist релиза 1.0`,
      );
    }
    return {
      formula_id: entry.formulaId,
      machine_name: entry.machineName,
      formula_version: entry.formulaVersion,
      origin: entry.origin,
    };
  });
}
