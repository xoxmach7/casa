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
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { demoEndpointsEnabled } from '../lib/demo-mode';
import {
  computeWhatIf,
  demoAnalysis,
  demoProperties,
  buildConclusionPayload,
  DEMO_BASE_INCOME,
  DEMO_EXISTING_PAYMENT,
} from '../lib/mortgage-workspace/engine';
import { createConsent, getConsent, createConclusion } from '../lib/mortgage-workspace/store';
import { extractTextFromPdf } from '../lib/scoring-document.service';
import { extractDocument } from '../lib/mortgage-workspace/extraction';
import {
  saveDocument,
  readMeta,
  readPdf,
  updateMeta,
  isValidId,
  canAccessDocument,
  newDocumentId,
  sha256Of,
  type MortgageDocType,
  type StoredDocumentMeta,
} from '../lib/mortgage-workspace/document-store';

export const mortgageWorkspaceRouter = Router();
mortgageWorkspaceRouter.use(authenticate);
mortgageWorkspaceRouter.use((_req: Request, res: Response, next): void => {
  if (!demoEndpointsEnabled()) { res.status(404).json({ error: 'Not found' }); return; }
  next();
});

// Приём PDF: только application/pdf, до 25 МБ (спека: max_file_size_mb 25).
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Принимается только PDF'));
  },
});

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

// --- Документы: приватная загрузка, хранение и распознавание ------------------

// POST /api/mortgage-workspace/documents — загрузить PDF (credit_history|enpf_statement),
// сохранить приватно на сервере и распознать поля по спецификации.
mortgageWorkspaceRouter.post(
  '/documents',
  pdfUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      const type = String(req.body?.type || '') as MortgageDocType;
      if (!file) {
        res.status(400).json({ error: 'Файл не получен (поле file)' });
        return;
      }
      if (type !== 'credit_history' && type !== 'enpf_statement') {
        res.status(400).json({ error: 'Укажите type: credit_history или enpf_statement' });
        return;
      }

      const buffer = file.buffer;
      const sha256 = sha256Of(buffer);
      const id = newDocumentId();

      // Реальное извлечение текстового слоя PDF, затем распознавание по спеке.
      let extraction;
      let extractionFailed = false;
      try {
        const text = await extractTextFromPdf(buffer);
        extraction = extractDocument(type, text);
      } catch (e) {
        extractionFailed = true;
        extraction = {
          docType: type, template: 'UNKNOWN', supported: false,
          statuses: { file_integrity: 'UNREADABLE', authenticity: 'MANUAL_REVIEW_REQUIRED', extraction: 'FAILED' },
          fields: [], derived: {}, gates: ['SAMPLE_REQUIRED'],
          notes: ['Не удалось извлечь текстовый слой PDF (возможно скан/фото — нужен OCR, вне текущего контура).'],
          reviewRequired: true, textChars: 0,
        };
      }

      const meta: StoredDocumentMeta = {
        id,
        type,
        fileName: file.originalname || `${type}.pdf`,
        size: file.size,
        sha256,
        status: extractionFailed ? 'processing_failed' : 'needs_review',
        uploadedBy: req.user?.userId,
        caseRef: typeof req.body?.caseRef === 'string' ? req.body.caseRef : undefined,
        storedAt: new Date().toISOString(),
        extraction,
      };
      saveDocument(buffer, meta);

      res.status(201).json({
        id,
        type,
        fileName: meta.fileName,
        size: meta.size,
        sha256,
        status: meta.status,
        storedAt: meta.storedAt,
        stored: true,
        extraction,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Не удалось обработать документ';
      console.error('Mortgage document upload error:', msg);
      res.status(500).json({ error: msg });
    }
  },
);

// GET /api/mortgage-workspace/documents/:id — метаданные + распознанные поля (без байтов)
mortgageWorkspaceRouter.get('/documents/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!isValidId(id)) { res.status(400).json({ error: 'Некорректный id' }); return; }
  const meta = readMeta(id);
  if (!meta || !canAccessDocument(meta, req.user)) { res.status(404).json({ error: 'Документ не найден' }); return; }
  res.json(meta);
});

// GET /api/mortgage-workspace/documents/:id/file — приватная выдача PDF (только авторизованным)
mortgageWorkspaceRouter.get('/documents/:id/file', (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!isValidId(id)) { res.status(400).json({ error: 'Некорректный id' }); return; }
  const meta = readMeta(id);
  if (!meta || !canAccessDocument(meta, req.user)) { res.status(404).json({ error: 'Документ не найден' }); return; }
  const bytes = readPdf(id);
  if (!bytes) { res.status(404).json({ error: 'Документ не найден' }); return; }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.fileName)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(bytes);
});

// PATCH /api/mortgage-workspace/documents/:id/confirm — подтвердить данные документа
mortgageWorkspaceRouter.patch('/documents/:id/confirm', (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!isValidId(id)) { res.status(400).json({ error: 'Некорректный id' }); return; }
  const meta = readMeta(id);
  if (!meta || !canAccessDocument(meta, req.user)) { res.status(404).json({ error: 'Документ не найден' }); return; }
  const updated = updateMeta(id, { status: 'confirmed' });
  if (!updated) { res.status(404).json({ error: 'Документ не найден' }); return; }
  res.json({ id, status: updated.status });
});

export default mortgageWorkspaceRouter;
