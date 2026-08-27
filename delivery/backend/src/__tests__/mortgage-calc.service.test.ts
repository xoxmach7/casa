/**
 * M06 runCalculation — поведение прогона поверх канонического контекста §21.
 * Golden-хэши FX-CALC-GOLDEN-001 проверяются отдельно в m06-golden.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  runCalculation,
  M06_ENGINE_VERSION,
  type CalculationRunContext,
} from '../lib/mortgage-workspace/mortgage-calc.service';

/** Базовый контекст: ссылки на снапшоты обязательны (§21), деньги — из M05. */
function ctx(overrides: Partial<CalculationRunContext> = {}): CalculationRunContext {
  return {
    caseId: 'case_test_001',
    clientProfileSnapshot: { snapshotId: 'cps_test_001', snapshotHash: 'b'.repeat(64) },
    selectedUpstreamRefs: {
      iin_check_batch_id: null,
      credit_history_snapshot_id: null,
      pension_snapshot_id: null,
    },
    targetPrice: { amount: '30000000.00', status: 'CONFIRMED' },
    availableNowDownPayment: { amount: '5000000.00', status: 'CONFIRMED' },
    parameters: { annualNominalRatePercent: '12.5', termMonths: 240, paymentFrequency: 'MONTHLY' },
    ...overrides,
  };
}

describe('runCalculation — прогон M06 (required_financing → аннуитет)', () => {
  it('P=30M, A=5M, a=12.5%, n=240 → фин. 25M, платёж 284035.14', () => {
    const r = runCalculation(ctx());
    expect(r.results.requiredFinancing.value).toBe('25000000.00');
    expect(r.results.annuity.value).toBe('284035.14');
    expect(r.results.annuity.displayKzt).toBe(284_035);
    expect(r.results.status).toBe('COMPLETED');
    expect(r.results.engineVersion).toBe(M06_ENGINE_VERSION);
    expect(r.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.outputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.replayHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('детерминизм: одинаковый контекст → те же три хэша (replay)', () => {
    const a = runCalculation(ctx());
    const b = runCalculation(ctx());
    expect(a.inputHash).toBe(b.inputHash);
    expect(a.outputHash).toBe(b.outputHash);
    expect(a.replayHash).toBe(b.replayHash);
  });

  it('другой снапшот профиля → другой replay_hash при тех же числах', () => {
    const a = runCalculation(ctx());
    const b = runCalculation(ctx({
      clientProfileSnapshot: { snapshotId: 'cps_test_002', snapshotHash: 'c'.repeat(64) },
    }));
    expect(b.inputHash).toBe(a.inputHash); // входы те же
    expect(b.replayHash).not.toBe(a.replayHash); // контекст воспроизведения — нет
  });

  it('финансирование заблокировано (P=MISSING) → аннуитет тоже BLOCKED, ноль не подставляется', () => {
    const r = runCalculation(ctx({ targetPrice: { amount: null, status: 'MISSING' } }));
    expect(r.results.requiredFinancing.value).toBeNull();
    expect(r.results.annuity.value).toBeNull();
    expect(r.results.status).toBe('BLOCKED');
    expect(r.results.codes).toContain('MISSING_INPUT:P');
    expect(r.results.blockers.map((b) => b.code)).toContain('MISSING_INPUT');
  });

  it('первый взнос покрывает цель → фин. 0, платёж 0, коды прокинуты', () => {
    const r = runCalculation(ctx({
      targetPrice: { amount: '20000000.00', status: 'CONFIRMED' },
      availableNowDownPayment: { amount: '25000000.00', status: 'CONFIRMED' },
    }));
    expect(r.results.requiredFinancing.value).toBe('0.00');
    expect(r.results.annuity.value).toBe('0.00'); // principal 0 → платёж 0
    expect(r.results.codes).toContain('DOWN_PAYMENT_COVERS_TARGET');
  });

  it('replay payload содержит только поля allowlist §29', () => {
    const r = runCalculation(ctx());
    expect(Object.keys(r.replayPayload).sort()).toEqual([
      'blockers', 'case_id', 'client_profile_snapshot', 'decimal_context_version',
      'engine_version', 'formula_registry_version', 'formula_versions',
      'inputs', 'outputs', 'schema_version', 'selected_upstream_refs',
    ]);
  });
});
