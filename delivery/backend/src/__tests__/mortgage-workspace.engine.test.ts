import { describe, it, expect } from 'vitest';
import {
  computeWhatIf,
  buildConclusionPayload,
  demoAnalysis,
  demoProperties,
  demoScenarios,
  DEMO_BASE_INCOME,
  DEMO_EXISTING_PAYMENT,
  type WhatIfInput,
} from '../lib/mortgage-workspace/engine';

// Базовый ввод «Что если» для демо-клиента (30 млн / 5 млн взнос / 240 мес).
function baseInput(overrides: Partial<WhatIfInput> = {}): WhatIfInput {
  return {
    propertyPrice: 30_000_000,
    downPayment: 5_000_000,
    termMonths: 240,
    rate: 12.5,
    existingDebtPayment: DEMO_EXISTING_PAYMENT,
    additionalConfirmedIncome: 0,
    baseIncome: DEMO_BASE_INCOME,
    ...overrides,
  };
}

describe('computeWhatIf', () => {
  it('при КДН ≤ 35% открывает 4 программы', () => {
    // Малый кредит + высокий доход → низкий КДН.
    const result = computeWhatIf(
      baseInput({
        propertyPrice: 12_000_000,
        downPayment: 5_000_000,
        existingDebtPayment: 0,
        baseIncome: 1_500_000,
      })
    );
    expect(result.kdn).toBeLessThanOrEqual(35);
    expect(result.eligibleProgramsCount).toBe(4);
  });

  it('при высокой долговой нагрузке открывает 0 программ', () => {
    const result = computeWhatIf(
      baseInput({ existingDebtPayment: 400_000, baseIncome: 500_000 })
    );
    expect(result.kdn).toBeGreaterThan(50);
    expect(result.eligibleProgramsCount).toBe(0);
  });

  it('аннуитетный платёж больше нуля при положительном кредите', () => {
    const result = computeWhatIf(baseInput());
    expect(result.loanAmount).toBe(25_000_000);
    expect(result.monthlyPayment).toBeGreaterThan(0);
  });

  it('КДН растёт с ростом существующего долга', () => {
    const low = computeWhatIf(baseInput({ existingDebtPayment: 50_000 }));
    const high = computeWhatIf(baseInput({ existingDebtPayment: 200_000 }));
    expect(high.kdn).toBeGreaterThan(low.kdn);
  });

  it('промежуточный порог КДН (35..45) даёт 3 программы', () => {
    // Кредит 13 млн → КДН около 40% при базовом доходе/долге демо-клиента.
    const mid = computeWhatIf(baseInput({ propertyPrice: 18_000_000, downPayment: 5_000_000 }));
    expect(mid.kdn).toBeGreaterThan(35);
    expect(mid.kdn).toBeLessThanOrEqual(45);
    expect(mid.eligibleProgramsCount).toBe(3);
  });
});

describe('buildConclusionPayload', () => {
  const payload = buildConclusionPayload({
    token: 'tok-test',
    createdAt: '2026-08-20T00:00:00.000Z',
    expiresAt: '2026-08-27T00:00:00.000Z',
    displayName: 'Айдос',
    whatIf: baseInput(),
    selectedScenarioId: 'sc-refi',
    selectedPropertyIds: ['pm-1', 'pm-2'],
  });

  it('НЕ содержит полей iin/documents/notes (AC-014)', () => {
    const json = JSON.stringify(payload).toLowerCase();
    expect(json).not.toContain('iin');
    expect(json).not.toContain('иин');
    expect(payload).not.toHaveProperty('iin');
    expect(payload).not.toHaveProperty('documents');
    expect(payload).not.toHaveProperty('notes');
    expect(payload.client).not.toHaveProperty('iin');
    expect(payload.client).not.toHaveProperty('phone');
  });

  it('собирает сводку, выбранный сценарий и отфильтрованные квартиры', () => {
    expect(payload.demo).toBe(true);
    expect(payload.summary.loanAmount).toBe(25_000_000);
    expect(payload.selectedScenario?.title).toBe('Рефинансировать дорогой потребкредит');
    expect(payload.properties).toHaveLength(2);
    expect(payload.programs.length).toBeGreaterThan(0);
  });
});

describe('demo-данные зеркалят фронтенд', () => {
  it('анализ, сценарии и подбор непустые', () => {
    expect(demoAnalysis().programResults).toHaveLength(4);
    expect(demoScenarios()).toHaveLength(6);
    expect(demoProperties()).toHaveLength(4);
  });
});
