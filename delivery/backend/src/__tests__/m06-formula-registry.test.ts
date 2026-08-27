/**
 * M06 §21 requested_calculations: «Ordered formula IDs + versions;
 * unknown/disabled ID rejected safely».
 *
 * Смысл тестов — не «функция возвращает массив», а что реестр РАБОТАЕТ КАК
 * СТОРОЖ: неизвестное и отключённое отвергается, порядок сохраняется, а
 * умолчание всё равно разворачивается в точные id и версии.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveRequestedCalculations,
  FormulaNotAllowedError,
  M06_FORMULA_REGISTRY,
  M06_FORMULA_REGISTRY_VERSION,
  M06_RELEASE_1_0_ALLOWLIST,
} from '../lib/mortgage-workspace/m06-formula-registry';

describe('M06 formula registry', () => {
  it('версия реестра — точная строка спеки', () => {
    expect(M06_FORMULA_REGISTRY_VERSION).toBe('m06-registry/1.0.0');
  });

  it('без запроса берётся allowlist 1.0, но разворачивается в точные id/версии', () => {
    const resolved = resolveRequestedCalculations();
    expect(resolved).toEqual([
      {
        formula_id: 'CALC-F-001',
        machine_name: 'casa.required_financing',
        formula_version: '1.0.0',
        origin: 'CASA_NEUTRAL / M06_CASA_NEUTRAL_1_0',
      },
      {
        formula_id: 'CALC-F-002',
        machine_name: 'casa.annuity_payment_by_parameters',
        formula_version: '1.0.0',
        origin: 'CASA_NEUTRAL / M06_CASA_NEUTRAL_1_0',
      },
    ]);
  });

  it('порядок запроса сохраняется', () => {
    const resolved = resolveRequestedCalculations(['CALC-F-002', 'CALC-F-001']);
    expect(resolved.map((r) => r.formula_id)).toEqual(['CALC-F-002', 'CALC-F-001']);
  });

  it('неизвестная формула отвергается, а не подменяется похожей', () => {
    expect(() => resolveRequestedCalculations(['CALC-F-999']))
      .toThrow(FormulaNotAllowedError);
    try {
      resolveRequestedCalculations(['CALC-F-999']);
    } catch (e) {
      expect((e as FormulaNotAllowedError).code).toBe('UNKNOWN_FORMULA');
    }
  });

  it('REG-F-001 (банковский КДН) известен реестру, но DISABLED и отвергается', () => {
    const reg = M06_FORMULA_REGISTRY.find((f) => f.formulaId === 'REG-F-001');
    expect(reg?.status).toBe('DISABLED');
    // Норматив №52 в редакции №92 — не №215.
    expect(reg?.formulaVersion).toBe('2025-52/2026-92');
    expect(M06_RELEASE_1_0_ALLOWLIST).not.toContain('REG-F-001');

    try {
      resolveRequestedCalculations(['REG-F-001']);
      throw new Error('должно было отвергнуть');
    } catch (e) {
      expect((e as FormulaNotAllowedError).code).toBe('FORMULA_DISABLED');
    }
  });

  it('дубликат в запросе отвергается (иначе порядок и версии неоднозначны)', () => {
    try {
      resolveRequestedCalculations(['CALC-F-001', 'CALC-F-001']);
      throw new Error('должно было отвергнуть');
    } catch (e) {
      expect((e as FormulaNotAllowedError).code).toBe('DUPLICATE_FORMULA');
    }
  });
});
