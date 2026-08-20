/**
 * CASA Pro Ипотека — приватные эндпоинты «ипотечного рабочего экрана» (demo).
 *
 * DEMO-режим (production-safe): состояния хранятся во in-memory Map (см.
 * lib/mortgage-workspace/store.ts), движки — чистая логика (engine.ts). Реальные
 * PII/SMS/скоринг здесь не задействованы. Все ответы — предварительные.
 * Требует авторизации специалиста CASA (authenticate).
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import {
  computeWhatIf,
  demoAnalysis,
  demoProperties,
  buildConclusionPayload,
  DEMO_BASE_INCOME,
  DEMO_EXISTING_PAYMENT,
} from '../lib/mortgage-workspace/engine';
import { createConsent, getConsent, createConclusion } from '../lib/mortgage-workspace/store';

export const mortgageWorkspaceRouter = Router();
mortgageWorkspaceRouter.use(authenticate);

// --- Демо-данные -------------------------------------------------------------

// GET /api/mortgage-workspace/demo/analysis — вердикты программ демо-клиента
mortgageWorkspaceRouter.get('/demo/analysis', (_req: Request, res: Response): void => {
  res.json(demoAnalysis());
});

// GET /api/mortgage-workspace/demo/properties — подбор новостроек демо-клиента
mortgageWorkspaceRouter.get('/demo/properties', (_req: Request, res: Response): void => {
  res.json(demoProperties());
});

// --- Что-если ----------------------------------------------------------------

const whatIfSchema = z.object({
  propertyPrice: z.number().nonnegative(),
  downPayment: z.number().nonnegative(),
  termMonths: z.number().int().positive(),
  rate: z.number().nonnegative(),
  existingDebtPayment: z.number().nonnegative().default(DEMO_EXISTING_PAYMENT),
  additionalConfirmedIncome: z.number().default(0),
  baseIncome: z.number().positive().default(DEMO_BASE_INCOME),
});

// POST /api/mortgage-workspace/whatif — live-пересчёт параметров
mortgageWorkspaceRouter.post('/whatif', (req: Request, res: Response): void => {
  try {
    const input = whatIfSchema.parse(req.body);
    res.json(computeWhatIf(input));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('WhatIf compute error:', error);
    res.status(500).json({ error: 'Не удалось выполнить расчёт' });
  }
});

// --- Согласия ----------------------------------------------------------------

const createConsentSchema = z.object({
  clientName: z.string().min(1, 'Укажите имя клиента').max(200),
  phone: z.string().min(1, 'Укажите телефон').max(32),
});

// POST /api/mortgage-workspace/consents — создать заявку на согласие (demo SMS)
mortgageWorkspaceRouter.post('/consents', (req: Request, res: Response): void => {
  try {
    const data = createConsentSchema.parse(req.body);
    const record = createConsent(data);
    res.status(201).json({
      consentId: record.consentId,
      token: record.token,
      link: `/consent/${record.token}`,
      status: record.status,
      // DEMO: SMS не отправляется, код возвращаем специалисту для показа/проверки.
      demoCode: record.code,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create consent error:', error);
    res.status(500).json({ error: 'Не удалось создать согласие' });
  }
});

// GET /api/mortgage-workspace/consents/:token — статус согласия (для поллинга)
mortgageWorkspaceRouter.get('/consents/:token', (req: Request, res: Response): void => {
  const record = getConsent(req.params.token);
  if (!record) {
    res.status(404).json({ error: 'Согласие не найдено' });
    return;
  }
  res.json({ status: record.status });
});

// --- Заключения --------------------------------------------------------------

const whatIfBodySchema = z.object({
  propertyPrice: z.number().nonnegative(),
  downPayment: z.number().nonnegative(),
  termMonths: z.number().int().positive(),
  rate: z.number().nonnegative(),
  existingDebtPayment: z.number().nonnegative().default(DEMO_EXISTING_PAYMENT),
  additionalConfirmedIncome: z.number().default(0),
  baseIncome: z.number().positive().default(DEMO_BASE_INCOME),
});

const createConclusionSchema = z.object({
  displayName: z.string().max(200).optional(),
  whatIf: whatIfBodySchema,
  selectedScenarioId: z.string().nullable().optional(),
  selectedPropertyIds: z.array(z.string()).optional(),
});

// POST /api/mortgage-workspace/conclusions — собрать безопасное клиентское
// заключение и получить публичную ссылку /z/:token (живёт 7 дней).
mortgageWorkspaceRouter.post('/conclusions', (req: Request, res: Response): void => {
  try {
    const data = createConclusionSchema.parse(req.body);
    const token = crypto.randomBytes(16).toString('hex');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const payload = buildConclusionPayload({
      token,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      displayName: data.displayName,
      whatIf: data.whatIf,
      selectedScenarioId: data.selectedScenarioId ?? null,
      selectedPropertyIds: data.selectedPropertyIds,
    });
    createConclusion(token, payload);

    res.status(201).json({
      conclusionId: payload.token,
      token,
      link: `/z/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create conclusion error:', error);
    res.status(500).json({ error: 'Не удалось сформировать заключение' });
  }
});

export default mortgageWorkspaceRouter;
