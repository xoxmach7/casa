/**
 * CASA Pro Ипотека — публичные эндпоинты (без авторизации), token-gated.
 *
 * Открываются клиентом по одноразовой ссылке: страница согласия (Phase 1) и
 * клиентское заключение (Phase 3). DEMO-режим: SMS реально не отправляется,
 * код детерминированно выводится из токена (см. store.demoCodeFromToken).
 * Персональные данные не раскрываются сверх маскированного имени/телефона;
 * заключение НЕ содержит ИИН, документов и внутренних заметок (AC-014).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getConsent,
  updateConsent,
  getConclusion,
  MAX_CONSENT_ATTEMPTS,
} from '../lib/mortgage-workspace/store';

export const publicMortgageRouter = Router();

// --- Согласие ----------------------------------------------------------------

// GET /api/public/mortgage/consent/:token — данные для страницы согласия
publicMortgageRouter.get('/consent/:token', (req: Request, res: Response): void => {
  const record = getConsent(req.params.token);
  if (!record) {
    res.status(404).json({ error: 'Согласие не найдено' });
    return;
  }
  // Первое открытие ссылки переводит sms_pending → link_opened (не откатывает
  // уже подтверждённый/отклонённый статус).
  if (record.status === 'sms_pending') {
    updateConsent(req.params.token, { status: 'link_opened' });
  }
  res.json({
    purposes: record.purposes,
    clientMasked: record.clientMasked,
    phoneMasked: record.phoneMasked,
    textVersion: record.textVersion,
    status: getConsent(req.params.token)!.status,
  });
});

const verifySchema = z.object({
  code: z.string().min(1, 'Введите код'),
});

// POST /api/public/mortgage/consent/:token/verify — проверка кода из «SMS»
publicMortgageRouter.post('/consent/:token/verify', (req: Request, res: Response): void => {
  try {
    const { code } = verifySchema.parse(req.body);
    const record = getConsent(req.params.token);
    if (!record) {
      res.status(404).json({ error: 'Согласие не найдено' });
      return;
    }

    // Уже подтверждено — идемпотентно возвращаем успех.
    if (record.status === 'confirmed') {
      res.json({ status: 'confirmed' });
      return;
    }

    // Исчерпан лимит попыток — блок.
    if (record.attempts >= MAX_CONSENT_ATTEMPTS) {
      res.status(429).json({ status: 'error', attemptsLeft: 0 });
      return;
    }

    if (code.trim() === record.code) {
      updateConsent(req.params.token, { status: 'confirmed' });
      res.json({ status: 'confirmed' });
      return;
    }

    const attempts = record.attempts + 1;
    updateConsent(req.params.token, { attempts });
    res.json({ status: 'error', attemptsLeft: Math.max(0, MAX_CONSENT_ATTEMPTS - attempts) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Consent verify error:', error);
    res.status(500).json({ error: 'Не удалось проверить код' });
  }
});

const decideSchema = z.object({
  decision: z.literal('reject'),
});

// POST /api/public/mortgage/consent/:token/decide — отклонить согласие
publicMortgageRouter.post('/consent/:token/decide', (req: Request, res: Response): void => {
  try {
    decideSchema.parse(req.body);
    const record = getConsent(req.params.token);
    if (!record) {
      res.status(404).json({ error: 'Согласие не найдено' });
      return;
    }
    updateConsent(req.params.token, { status: 'rejected' });
    res.json({ status: 'rejected' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Consent decide error:', error);
    res.status(500).json({ error: 'Не удалось обработать решение' });
  }
});

// --- Заключение --------------------------------------------------------------

// GET /api/public/mortgage/conclusion/:token — безопасное клиентское заключение
publicMortgageRouter.get('/conclusion/:token', (req: Request, res: Response): void => {
  const payload = getConclusion(req.params.token);
  if (!payload) {
    res.status(404).json({ error: 'Заключение не найдено' });
    return;
  }
  res.json(payload);
});

export default publicMortgageRouter;
