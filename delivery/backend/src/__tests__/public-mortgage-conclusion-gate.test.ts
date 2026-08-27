/**
 * RELEASE GATE 1.0 — публичное ипотечное заключение не выдаётся клиенту.
 *
 * Проверяем не «страница не падает», а именно ЗАПРЕЩЁННОЕ содержимое: kdn,
 * принимаемый доход, вердикты программ, сценарии, подбор квартир. Тест обязан
 * ловить регресс, если кто-то вернёт payload обратно в публичный ответ.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import publicMortgageRouter from '../routes/public-mortgage.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/public/mortgage', publicMortgageRouter);
  return i;
}

const savedFlag = process.env.MORTGAGE_PUBLIC_CONCLUSION_ENABLED;
const savedDemo = process.env.ENABLE_DEMO_ENDPOINTS;

beforeEach(() => {
  // Роутер целиком закрыт демо-гейтом; включаем его, чтобы проверить, что
  // заключение остаётся закрытым СВОИМ флагом, а не чужим.
  process.env.ENABLE_DEMO_ENDPOINTS = 'true';
  delete process.env.MORTGAGE_PUBLIC_CONCLUSION_ENABLED;
});

afterEach(() => {
  if (savedFlag === undefined) delete process.env.MORTGAGE_PUBLIC_CONCLUSION_ENABLED;
  else process.env.MORTGAGE_PUBLIC_CONCLUSION_ENABLED = savedFlag;
  if (savedDemo === undefined) delete process.env.ENABLE_DEMO_ENDPOINTS;
  else process.env.ENABLE_DEMO_ENDPOINTS = savedDemo;
});

describe('GET /api/public/mortgage/conclusion/:token — гейт релиза 1.0', () => {
  it('по умолчанию флаг выключен → 410 с нейтральным business state', async () => {
    const res = await request(app()).get('/api/public/mortgage/conclusion/tok_any');
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('MORTGAGE_CONCLUSION_UNAVAILABLE');
    expect(res.body.error.message).toContain('специалисту CASA');
  });

  it('в ответе нет ни одного запрещённого M06 поля и ни одной цифры', async () => {
    const res = await request(app()).get('/api/public/mortgage/conclusion/tok_any');
    const body = JSON.stringify(res.body);
    for (const forbidden of [
      'kdn', 'KDN', 'acceptedIncome', 'programs', 'verdict',
      'selectedScenario', 'properties', 'monthlyPayment', 'loanAmount', 'downPayment',
    ]) {
      expect(body).not.toContain(forbidden);
    }
    // Никаких финансовых величин: в нейтральном ответе цифр быть не должно.
    expect(body).not.toMatch(/\d{4,}/);
  });

  it('флаг не включается побочно демо-режимом', async () => {
    process.env.ENABLE_DEMO_ENDPOINTS = 'true';
    const res = await request(app()).get('/api/public/mortgage/conclusion/tok_any');
    expect(res.status).toBe(410);
  });
});
