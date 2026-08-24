import { describe, expect, it } from 'vitest';
import {
  checkSandboxIin,
  getSandboxAnalysis,
  getSandboxStatus,
  previewSandboxScenario,
} from '../lib/mortgage-sandbox-adapter';

describe('mortgage sandbox adapter', () => {
  it('describes a truthful synthetic-only sandbox', () => {
    expect(getSandboxStatus()).toEqual({
      mode: 'synthetic',
      productionSafe: true,
      officialIinCheck: false,
      externalSourceStatus: 'EXTERNAL_SOURCE_NOT_CONNECTED',
      policyVersion: '2026-08-24',
    });
  });

  it('separates IIN shape/checksum validation from an unavailable official source', () => {
    expect(checkSandboxIin('900101300017')).toEqual({
      shapeValid: true,
      checksumValid: true,
      externalSourceStatus: 'EXTERNAL_SOURCE_NOT_CONNECTED',
      officialResult: null,
    });
    expect(checkSandboxIin('123')).toMatchObject({
      shapeValid: false,
      checksumValid: false,
      externalSourceStatus: 'EXTERNAL_SOURCE_NOT_CONNECTED',
      officialResult: null,
    });
  });

  it('runs deterministic analysis through the real mortgage core', () => {
    const first = getSandboxAnalysis();
    const second = getSandboxAnalysis();
    expect(first.sandbox).toBe(true);
    expect(first.analysis.outputHash).toBe(second.analysis.outputHash);
    expect(first.analysis.assessments.length).toBeGreaterThan(0);
    expect(first.analysis.disclaimer).toContain('Окончательное решение принимает банк');
  });

  it('previews sandbox changes through the real scenario core', () => {
    const result = previewSandboxScenario([
      { type: 'increase_down_payment', additionalDownPayment: '2000000' },
    ]);
    expect(result.sandbox).toBe(true);
    expect(result.scenario.snapshot.property?.downPaymentCash).toBe('10000000');
    expect(result.scenario.after.outputHash).not.toBe(result.scenario.before.outputHash);
  });
});
