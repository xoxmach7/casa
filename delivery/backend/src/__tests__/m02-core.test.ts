/**
 * M02 R0 — ядро: валидация ИИН, реестр/манифест, строгий NOT_FOUND, coverage.
 *
 * Тесты соответствуют T-001…T-026 и AT-IIN-001…016 в применимой части.
 * Проверяется не «функция что-то вернула», а именно ЗАПРЕТЫ спеки: частичная
 * проверка не выглядит чистой, недоступность не превращается в «нет записей»,
 * UNKNOWN не склеивается с нулём, коннекторы выключены.
 */

import { describe, it, expect } from 'vitest';
import { validateIin, maskIin, iinLookupToken, redactIinLike } from '../lib/mortgage-m02/iin';
import {
  EXTERNAL_SOURCE_REGISTRY,
  EXTERNAL_SOURCE_REGISTRY_VERSION,
  MANIFEST_V1_VERSION,
  M02_CONSENT_PURPOSE,
  freezeManifestV1,
  isConnectorAllowed,
  getSource,
} from '../lib/mortgage-m02/source-registry';
import { normalizeObservation, isProvenNegative } from '../lib/mortgage-m02/not-found-mapper';
import { computeCoverage, buildFreshness, computeFreshUntil, type CoverageInputResult } from '../lib/mortgage-m02/coverage';

// --- T-001/T-002, AT-IIN-013 ------------------------------------------------

describe('M02 §7 — валидация ИИН', () => {
  it('принимает ИИН с корректным контрольным разрядом', () => {
    // Синтетические ИИН: контрольный разряд посчитан самим алгоритмом,
    // а не подобран. Реальным лицам не принадлежат.
    for (const ok of ['900101300057', '850310500123', '771122400011', '991231999992']) {
      expect(validateIin(ok).valid).toBe(true);
    }
  });

  it('отвергает не 12 цифр и не исправляет ввод', () => {
    for (const bad of ['12345678901', '1234567890123', '90010130005a', '', ' 900101300054']) {
      const r = validateIin(bad);
      expect(r.valid).toBe(false);
      expect(r.code).toBe('IIN_FORMAT');
    }
  });

  it('отвергает неверный контрольный разряд', () => {
    // Тот же базис, но разряд сдвинут на единицу.
    const r = validateIin('900101300058');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('IIN_CHECK_DIGIT');
  });

  it('сообщение об ошибке не содержит сам ИИН', () => {
    const r = validateIin('900101300058');
    expect(r.message).not.toContain('900101300058');
  });

  it('маска раскрывает только две последние цифры', () => {
    expect(maskIin('900101300057')).toBe('••••••••••57');
    // Невалидный вход маскируется целиком: не подтверждаем даже длину.
    expect(maskIin('abc')).toBe('••••••••••••');
  });

  it('токен поиска детерминирован и не содержит ИИН', () => {
    const key = 'x'.repeat(48);
    const a = iinLookupToken('900101300057', key);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(iinLookupToken('900101300057', key));
    expect(a).not.toContain('900101300057');
  });

  it('без ключа токен не строится (иначе он обратим перебором)', () => {
    expect(() => iinLookupToken('900101300057', undefined)).toThrow();
    expect(() => iinLookupToken('900101300057', 'short')).toThrow();
  });

  it('редактор вырезает ИИН-подобные последовательности из текста', () => {
    expect(redactIinLike('subject 900101300057 failed')).toBe('subject •••••••••••• failed');
  });

  it('модуль не выводит пол и дату рождения из ИИН', async () => {
    const mod = await import('../lib/mortgage-m02/iin');
    const names = Object.keys(mod).join(' ').toLowerCase();
    expect(names).not.toMatch(/gender|sex|birth|dob|пол|рожд/);
  });
});

// --- T-005/T-006, AT-IIN-001/002/003 ---------------------------------------

describe('M02 §8 — source registry и Manifest v1', () => {
  it('реестр версионирован', () => {
    expect(EXTERNAL_SOURCE_REGISTRY_VERSION).toMatch(/^casa\.m02\.source-registry\//);
    expect(MANIFEST_V1_VERSION).toMatch(/^casa\.m02\.manifest\//);
  });

  it('ВСЕ коннекторы выключены: R0 работает без единого production-вызова', () => {
    for (const s of EXTERNAL_SOURCE_REGISTRY) {
      expect(s.connectorEnabled).toBe(false);
      expect(isConnectorAllowed(s)).toBe(false);
    }
  });

  it('знаменатель базового манифеста — семь BASE_REQUIRED check_type', () => {
    const m = freezeManifestV1();
    expect(m.requiredTotal).toBe(7);
    const required = m.entries.filter((e) => e.required).map((e) => e.checkType).sort();
    expect(required).toEqual([
      'bankruptcy_judicial_restoration',
      'bankruptcy_nonjudicial',
      'enforcement_proceedings',
      'executive_inscription',
      'exit_restriction',
      'tax_debt',
      'taxpayer_ip_status',
    ]);
  });

  it('exit_restriction — отдельная обязательная проверка, а не часть AIS OIP', () => {
    const m = freezeManifestV1();
    const exit = m.entries.find((e) => e.checkType === 'exit_restriction');
    const enf = m.entries.find((e) => e.checkType === 'enforcement_proceedings');
    expect(exit?.required).toBe(true);
    expect(exit?.sourceCode).not.toBe(enf?.sourceCode);
  });

  it('conditional входит в знаменатель только после доказанного условия', () => {
    const base = freezeManifestV1();
    const withIp = freezeManifestV1({ provenConditionalCheckTypes: ['kgd_counterparty_profile'] });
    expect(base.requiredTotal).toBe(7);
    expect(withIp.requiredTotal).toBe(8);
  });

  it('PROHIBITED в манифест не попадают вовсе', () => {
    const m = freezeManifestV1();
    expect(m.entries.some((e) => e.sourceClass === 'PROHIBITED')).toBe(false);
    // Но остаются в реестре — чтобы их можно было распознать и отвергнуть.
    expect(EXTERNAL_SOURCE_REGISTRY.some((s) => s.sourceClass === 'PROHIBITED')).toBe(true);
  });

  it('режимы R0 различимы: manual / client-authorized / unavailable / prohibited', () => {
    const modes = new Set(EXTERNAL_SOURCE_REGISTRY.map((s) => s.automationModeR0));
    expect(modes).toContain('MANUAL');
    expect(modes).toContain('CLIENT_AUTHORIZED');
    expect(modes).toContain('UNAVAILABLE');
    expect(modes).toContain('PROHIBITED');
    // AUTOMATIC в R0 не используется ни одним источником.
    expect(modes.has('AUTOMATIC')).toBe(false);
  });

  it('в официальных URL нет ИИН и параметров запроса', () => {
    for (const s of EXTERNAL_SOURCE_REGISTRY) {
      expect(s.officialUrl).not.toMatch(/\?/);
      expect(s.officialUrl).not.toMatch(/\d{12}/);
    }
  });

  it('цель согласия зафиксирована', () => {
    expect(M02_CONSENT_PURPOSE).toBe('mortgage_preanalysis_official_registry_checks');
    expect(freezeManifestV1().consentPurpose).toBe(M02_CONSENT_PURPOSE);
  });
});

// --- T-009…T-022, AT-IIN-006/008/011/012 -----------------------------------

describe('M02 §12 — строгий NOT_FOUND contract', () => {
  const S = 'AIS_OIP_ENFORCEMENT';

  it('HTTP 404 НЕ становится not_found', () => {
    const r = normalizeObservation(S, { kind: 'HTTP_STATUS', status: 404 });
    expect(r.outcome).toBeNull();
    expect(r.status).toBe('UNAVAILABLE');
    expect(r.errorCategory).toBe('ACCESS_DENIED');
  });

  it('HTTP 403 → ACCESS_REQUIRED, не not_found', () => {
    const r = normalizeObservation(S, { kind: 'HTTP_STATUS', status: 403 });
    expect(r.outcome).toBeNull();
    expect(r.errorCategory).toBe('ACCESS_REQUIRED');
  });

  it('CAPTCHA → ручная проверка, не not_found', () => {
    const r = normalizeObservation(S, { kind: 'CAPTCHA' });
    expect(r.status).toBe('MANUAL_REQUIRED');
    expect(r.outcome).toBeNull();
  });

  it('таймаут и rate limit → источник недоступен, retryable', () => {
    for (const kind of ['TIMEOUT', 'RATE_LIMIT'] as const) {
      const r = normalizeObservation(S, { kind });
      expect(r.status).toBe('UNAVAILABLE');
      expect(r.outcome).toBeNull();
      expect(r.retryable).toBe(true);
    }
  });

  it('пустая HTML-страница и дрейф схемы → ERROR, не unknown-исход', () => {
    for (const kind of ['EMPTY_HTML', 'SCHEMA_DRIFT'] as const) {
      const r = normalizeObservation(S, { kind });
      expect(r.status).toBe('ERROR');
      expect(r.outcome).toBeNull();
      expect(r.errorCategory).toBe('SCHEMA_ERROR');
    }
  });

  it('выключенный legal gate → BLOCKED, коннектор не запускается', () => {
    const r = normalizeObservation(S, { kind: 'LEGAL_GATE_OFF' });
    expect(r.status).toBe('BLOCKED');
    expect(r.errorCategory).toBe('LEGAL_UNCONFIRMED');
  });

  it('пустое значение → UNKNOWN, и UNKNOWN не равен нулю', () => {
    const r = normalizeObservation(S, { kind: 'EMPTY_VALUE' });
    expect(r.outcome).toBe('UNKNOWN');
    expect(isProvenNegative(r.status, r.outcome)).toBe(false);
  });

  it('ручная задача без evidence → EVIDENCE_ERROR, не «записей нет»', () => {
    const r = normalizeObservation(S, { kind: 'MANUAL_WITHOUT_EVIDENCE' });
    expect(r.status).toBe('ERROR');
    expect(r.errorCategory).toBe('EVIDENCE_ERROR');
    expect(r.outcome).toBeNull();
  });

  it('документированный no-match с верным кодом и evidence → NOT_FOUND', () => {
    const r = normalizeObservation(S, {
      kind: 'DOCUMENTED_NO_MATCH', upstreamCode: 'AIS_OIP_SCSE001', evidenceRef: 'ev_1',
    });
    expect(r.status).toBe('COMPLETED');
    expect(r.outcome).toBe('NOT_FOUND');
    expect(isProvenNegative(r.status, r.outcome)).toBe(true);
  });

  it('чужой upstream-код → UNKNOWN, а не NOT_FOUND', () => {
    const r = normalizeObservation(S, {
      kind: 'DOCUMENTED_NO_MATCH', upstreamCode: 'SOMETHING_ELSE', evidenceRef: 'ev_1',
    });
    expect(r.outcome).toBe('UNKNOWN');
  });

  it('no-match без evidence не принимается', () => {
    const r = normalizeObservation(S, {
      kind: 'DOCUMENTED_NO_MATCH', upstreamCode: 'AIS_OIP_SCSE001', evidenceRef: '',
    });
    expect(r.errorCategory).toBe('EVIDENCE_ERROR');
    expect(r.outcome).toBeNull();
  });

  it('у источника без контракта no-match доказанный negative невозможен', () => {
    const s = getSource('EGOV_PROPERTY_RIGHTS');
    expect(s?.noMatchContract).toBeNull();
    const r = normalizeObservation('EGOV_PROPERTY_RIGHTS', {
      kind: 'DOCUMENTED_NO_MATCH', upstreamCode: 'ANY', evidenceRef: 'ev_1',
    });
    expect(r.outcome).toBe('UNKNOWN');
  });

  it('выключенный коннектор R0 → UNAVAILABLE/ACCESS_REQUIRED', () => {
    const r = normalizeObservation(S, { kind: 'CONNECTOR_DISABLED' });
    expect(r.status).toBe('UNAVAILABLE');
    expect(r.outcome).toBeNull();
  });

  it('запрещённая проверка → NOT_ALLOWED без исхода', () => {
    const r = normalizeObservation('PROHIBITED_CREDIT_HISTORY_DIRECT', { kind: 'PROHIBITED' });
    expect(r.status).toBe('NOT_ALLOWED');
    expect(r.outcome).toBeNull();
  });
});

// --- T-023…T-026, AT-IIN-006/007/008 ---------------------------------------

describe('M02 §9 — coverage engine', () => {
  function res(over: Partial<CoverageInputResult> = {}): CoverageInputResult {
    return {
      checkType: 'enforcement_proceedings',
      required: true,
      status: 'COMPLETED',
      outcome: 'NOT_FOUND',
      evidenceValid: true,
      stale: false,
      ...over,
    };
  }

  it('все семь доказанных negative → COMPLETE_NO_RECORDS', () => {
    const results = Array.from({ length: 7 }, (_, i) => res({ checkType: `c${i}` }));
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('COMPLETE_NO_RECORDS');
    expect(c.completed).toBe(7);
    expect(c.provenNegative).toBe(7);
  });

  it('одна ручная задача ломает COMPLETE_NO_RECORDS → PARTIAL', () => {
    const results = [
      ...Array.from({ length: 6 }, (_, i) => res({ checkType: `c${i}` })),
      res({ checkType: 'c6', status: 'MANUAL_REQUIRED', outcome: null }),
    ];
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('PARTIAL');
    expect(c.manual).toBe(1);
    expect(c.brokerText).toContain('6 из 7');
    expect(c.brokerText).toContain('Нельзя делать вывод об отсутствии записей');
  });

  it('недоступный источник не превращается в «нет записей»', () => {
    const results = [
      ...Array.from({ length: 6 }, (_, i) => res({ checkType: `c${i}` })),
      res({ checkType: 'c6', status: 'UNAVAILABLE', outcome: null }),
    ];
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('PARTIAL');
    expect(c.unavailable).toBe(1);
  });

  it('UNKNOWN не засчитывается как покрытие', () => {
    const results = [
      ...Array.from({ length: 6 }, (_, i) => res({ checkType: `c${i}` })),
      res({ checkType: 'c6', outcome: 'UNKNOWN' }),
    ];
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('PARTIAL');
    expect(c.unknown).toBe(1);
    expect(c.completed).toBe(6);
  });

  it('результат без evidence не считается завершённым', () => {
    const results = [
      ...Array.from({ length: 6 }, (_, i) => res({ checkType: `c${i}` })),
      res({ checkType: 'c6', evidenceValid: false }),
    ];
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('PARTIAL');
    expect(c.completed).toBe(6);
  });

  it('найденный факт при полном покрытии → COMPLETE_FACTS_FOUND', () => {
    const results = [
      ...Array.from({ length: 6 }, (_, i) => res({ checkType: `c${i}` })),
      res({ checkType: 'c6', outcome: 'FOUND' }),
    ];
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('COMPLETE_FACTS_FOUND');
    expect(c.found).toBe(1);
    expect(c.brokerText).toContain('не решение банка');
  });

  it('просроченный обязательный результат → STALE, приоритетнее полноты', () => {
    const results = Array.from({ length: 7 }, (_, i) => res({ checkType: `c${i}`, stale: i === 0 }));
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('STALE');
    expect(c.stale).toBe(1);
  });

  it('отсутствие согласия показывается до всего остального', () => {
    const results = Array.from({ length: 7 }, (_, i) => res({ checkType: `c${i}` }));
    const c = computeCoverage(7, results, { consentBlocked: true });
    expect(c.overallStatus).toBe('BLOCKED_CONSENT');
    expect(c.brokerText).toContain('Внешние запросы не выполнялись');
  });

  it('незакрытый legal gate → BLOCKED_LEGAL, а не отказ клиенту', () => {
    const c = computeCoverage(7, [], { legalBlocked: true });
    expect(c.overallStatus).toBe('BLOCKED_LEGAL');
    expect(c.brokerText).not.toMatch(/отказ|отклон/i);
  });

  it('пустой batch не может быть COMPLETE', () => {
    const c = computeCoverage(0, []);
    expect(c.overallStatus).toBe('PARTIAL');
  });

  it('conditional-результаты вне манифеста не влияют на знаменатель', () => {
    const results = [
      ...Array.from({ length: 7 }, (_, i) => res({ checkType: `c${i}` })),
      res({ checkType: 'property_rights', required: false, status: 'MANUAL_REQUIRED', outcome: null }),
    ];
    const c = computeCoverage(7, results);
    expect(c.overallStatus).toBe('COMPLETE_NO_RECORDS');
    expect(c.manual).toBe(0);
  });
});

// --- T-026/T-031, AT-IIN-010/015 -------------------------------------------

describe('M02 §13 — freshness', () => {
  const now = new Date('2026-08-27T12:00:00Z');

  it('три временные характеристики различаются и не схлопываются', () => {
    const f = buildFreshness({
      checkedAt: new Date('2026-08-20T00:00:00Z'),
      sourceDataAsOf: new Date('2026-08-01T00:00:00Z'),
      freshUntil: new Date('2026-08-27T00:00:00Z'),
      now,
    });
    expect(f.checkedAt).not.toBe(f.sourceDataAsOf);
    expect(f.sourceDataAsOf).not.toBe(f.freshUntil);
    expect(f.stale).toBe(true);
    expect(f.ageText).toBe('Проверено 7 дн. назад');
  });

  it('неизвестная дата актуальности сообщается явно, а не подменяется', () => {
    const f = buildFreshness({
      checkedAt: new Date('2026-08-27T00:00:00Z'), sourceDataAsOf: null, freshUntil: null, now,
    });
    expect(f.sourceDataAsOfText).toBe('Источник не указал дату актуальности');
    expect(f.sourceDataAsOf).toBeNull();
  });

  it('TTL=null означает UNKNOWN, а не «свежо навсегда»', () => {
    expect(computeFreshUntil(now, null)).toBeNull();
    expect(computeFreshUntil(now, 7 * 24 * 3600)?.toISOString()).toBe('2026-09-03T12:00:00.000Z');
  });
});
