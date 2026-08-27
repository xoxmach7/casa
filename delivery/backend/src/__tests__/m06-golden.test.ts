/**
 * FX-CALC-GOLDEN-001 — golden fixture M06 (Production Spec v1.4, §29).
 *
 * Это RG11-evidence: движок обязан воспроизвести ТРИ хэша точно. Значения взяты
 * из §29 замороженной спеки. Правило владельца: при расхождении — FAIL
 * IMPLEMENTATION; фикстуру и хэши под код НЕ подгонять.
 */

import { describe, it, expect } from 'vitest';
import {
  runCalculation,
  M06_SCHEMA_VERSION,
  M06_ENGINE_VERSION,
  M06_FORMULA_REGISTRY_VERSION,
  M06_DECIMAL_CONTEXT_VERSION,
  M06_CANONICALIZATION_VERSION,
  type CalculationRunContext,
} from '../lib/mortgage-workspace/mortgage-calc.service';
import { canonicalize, CasaCjError } from '../lib/mortgage-workspace/casa-cj1';

// --- Ожидаемые значения §29 (дословно) --------------------------------------

const GOLDEN = {
  inputHash: 'cb88c168e277aeae3d28d91f46643999fad2f6284b9a31c555f3e3665953fb47',
  outputHash: 'c1674aea4b8d1bc8bbc9fc8d1ecb76db85ee28f833be1971b81f19d2db642e60',
  replayHash: 'a7be2c777298f1d563e3f794fbe2f0b13b59549dda3f2dafc0deaee321693737',
  decimalContextVersion: 'casa.decimal_context/p50-half-even__money-half-up/1.0.0',
  requiredFinancing: '25000000.00',
  annuityRaw: '284035.13742859237380498879610315991992807755394768',
  annuityPersisted: '284035.14',
  annuityDisplay: '284035 ₸',
} as const;

/** Слои M01→M05 golden-фикстуры (§29, synthetic no-PII). */
const GOLDEN_CONTEXT: CalculationRunContext = {
  caseId: 'case_fx_calc_001',
  clientProfileSnapshot: {
    snapshotId: 'cps_fx_calc_001',
    snapshotHash: 'a'.repeat(64),
  },
  selectedUpstreamRefs: {
    iin_check_batch_id: 'batch_fx_iin_001',
    credit_history_snapshot_id: 'chs_fx_ch_001',
    pension_snapshot_id: 'pcs_fx_pc_001',
  },
  targetPrice: { amount: '30000000.00', status: 'CONFIRMED' },
  availableNowDownPayment: { amount: '5000000.00', status: 'CONFIRMED' },
  parameters: {
    annualNominalRatePercent: '12.5',
    termMonths: 240,
    paymentFrequency: 'MONTHLY',
  },
};

describe('FX-CALC-GOLDEN-001 — числовые результаты (§29)', () => {
  const out = runCalculation(GOLDEN_CONTEXT);

  it('CALC-F-001 required_financing = 25 000 000.00 KZT, COMPLETED', () => {
    expect(out.results.requiredFinancing.value).toBe(GOLDEN.requiredFinancing);
    expect(out.results.requiredFinancing.status).toBe('COMPLETED');
  });

  it('CALC-F-002 raw — 50 значащих цифр без промежуточной квантизации', () => {
    expect(out.results.annuity.raw).toBe(GOLDEN.annuityRaw);
  });

  it('CALC-F-002 persisted ROUND_HALF_UP до 2 знаков', () => {
    expect(out.results.annuity.value).toBe(GOLDEN.annuityPersisted);
  });

  it('CALC-F-002 display — целые ₸ ROUND_HALF_UP от сырого', () => {
    expect(out.results.annuity.displayKzt).toBe(284035);
  });

  it('прогон COMPLETED без блокеров', () => {
    expect(out.results.status).toBe('COMPLETED');
    expect(out.results.blockers).toEqual([]);
  });
});

describe('FX-CALC-GOLDEN-001 — CASA-CJ-1 хэши (§29)', () => {
  const out = runCalculation(GOLDEN_CONTEXT);

  it('input_hash совпадает с golden', () => {
    expect(out.inputHash).toBe(GOLDEN.inputHash);
  });

  it('output_hash совпадает с golden', () => {
    expect(out.outputHash).toBe(GOLDEN.outputHash);
  });

  it('replay_hash совпадает с golden', () => {
    expect(out.replayHash).toBe(GOLDEN.replayHash);
  });

  it('decimal_context_version и envelope — точные строки спеки', () => {
    expect(M06_DECIMAL_CONTEXT_VERSION).toBe(GOLDEN.decimalContextVersion);
    expect(M06_SCHEMA_VERSION).toBe('casa.calculation_snapshot/1.0.0');
    expect(M06_ENGINE_VERSION).toBe('casa-calc-engine/1.0.0');
    expect(M06_FORMULA_REGISTRY_VERSION).toBe('m06-registry/1.0.0');
    expect(M06_CANONICALIZATION_VERSION).toBe('CASA-CJ-1');
  });

  it('canonical replay payload — байт в байт из §29', () => {
    expect(out.canonicalReplayPayload).toBe(
      '{"blockers":[],"case_id":"case_fx_calc_001","client_profile_snapshot":'
      + '{"snapshot_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",'
      + '"snapshot_id":"cps_fx_calc_001"},'
      + '"decimal_context_version":"casa.decimal_context/p50-half-even__money-half-up/1.0.0",'
      + '"engine_version":"casa-calc-engine/1.0.0",'
      + '"formula_registry_version":"m06-registry/1.0.0",'
      + '"formula_versions":["casa.required_financing/1.0.0","casa.annuity_payment_by_parameters/1.0.0"],'
      + '"inputs":{"annuity_payment":{"annual_nominal_rate_percent":"12.5000","payment_frequency":"MONTHLY",'
      + '"principal":{"amount":"25000000.00","currency":"KZT","source_output_ref":"casa.required_financing/1.0.0"},'
      + '"term_months":240},'
      + '"required_financing":{"available_now_down_payment":{"amount":"5000000.00","currency":"KZT",'
      + '"source_metric_ref":"available_now_total","status":"CONFIRMED"},'
      + '"target_price":{"amount":"30000000.00","currency":"KZT",'
      + '"source_field_ref":"purchase_goal.target_price_max","status":"CONFIRMED"}}},'
      + '"outputs":{"annuity_payment":{"display":"284035 ₸","persisted":{"amount":"284035.14","currency":"KZT"},'
      + '"raw":"284035.13742859237380498879610315991992807755394768","status":"COMPLETED"},'
      + '"required_financing":{"status":"COMPLETED","value":{"amount":"25000000.00","currency":"KZT"}}},'
      + '"schema_version":"casa.calculation_snapshot/1.0.0",'
      + '"selected_upstream_refs":{"credit_history_snapshot_id":"chs_fx_ch_001",'
      + '"iin_check_batch_id":"batch_fx_iin_001","pension_snapshot_id":"pcs_fx_pc_001"}}',
    );
  });

  it('прогон детерминирован: повтор даёт те же три хэша', () => {
    const again = runCalculation(GOLDEN_CONTEXT);
    expect([again.inputHash, again.outputHash, again.replayHash])
      .toEqual([out.inputHash, out.outputHash, out.replayHash]);
  });
});

describe('CASA-CJ-1 — правила канонизации §29', () => {
  it('ключи сортируются рекурсивно, порядок массивов сохраняется', () => {
    const a = canonicalize({ b: 1, a: { d: [3, 1, 2], c: 'x' } });
    const b = canonicalize({ a: { c: 'x', d: [3, 1, 2] }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":"x","d":[3,1,2]},"b":1}');
  });

  it('строки нормализуются в NFC', () => {
    const composed = canonicalize({ k: 'é' }); // é
    const decomposed = canonicalize({ k: 'é' }); // e + combining acute
    expect(composed).toBe(decomposed);
  });

  it('binary float запрещён — money/percent приходят строками', () => {
    expect(() => canonicalize({ amount: 284035.14 })).toThrow(CasaCjError);
    expect(() => canonicalize({ amount: '284035.14' })).not.toThrow();
  });

  it('целые допустимы (term_months)', () => {
    expect(canonicalize({ term_months: 240 })).toBe('{"term_months":240}');
  });
});

describe('M06 — блокировки не подставляют ноль', () => {
  it('UNKNOWN взнос блокирует обе формулы, значения null', () => {
    const out = runCalculation({
      ...GOLDEN_CONTEXT,
      availableNowDownPayment: { amount: null, status: 'UNKNOWN' },
    });
    expect(out.results.requiredFinancing.value).toBeNull();
    expect(out.results.annuity.value).toBeNull();
    expect(out.results.status).toBe('BLOCKED');
    expect(out.results.blockers.map((b) => b.code)).toContain('UNKNOWN_INPUT');
    // Хэши всё равно считаются: заблокированный прогон тоже воспроизводим.
    expect(out.replayHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('заявленный (DECLARED) вход даёт COMPLETED_WITH_LIMITATIONS, не COMPLETED', () => {
    const out = runCalculation({
      ...GOLDEN_CONTEXT,
      availableNowDownPayment: { amount: '5000000.00', status: 'DECLARED' },
    });
    expect(out.results.status).toBe('COMPLETED_WITH_LIMITATIONS');
    expect(out.results.annuity.codes).toContain('UNVERIFIED_INPUTS');
  });
});
