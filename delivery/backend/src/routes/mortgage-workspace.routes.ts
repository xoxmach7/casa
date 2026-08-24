/**
 * Authenticated CASA Pro mortgage workspace.
 *
 * The production route is a synthetic-data sandbox backed by deterministic
 * mortgage core services. Public demo routes remain separately fail-closed.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import {
  computeWhatIf,
  demoAnalysis,
  demoProperties,
  DEMO_BASE_INCOME,
  DEMO_EXISTING_PAYMENT,
} from '../lib/mortgage-workspace/engine';
import { extractTextFromPdf } from '../lib/scoring-document.service';
import { extractDocument } from '../lib/mortgage-workspace/extraction';
import { inspectMortgageSandboxPdf } from '../lib/mortgage-sandbox-policy';
import {
  checkSandboxIin,
  getSandboxAnalysis,
  getSandboxStatus,
  previewSandboxScenario,
} from '../lib/mortgage-sandbox-adapter';
import type { MortgageScenarioChange } from '../lib/mortgage-scenario.service';
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

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Принимается только PDF'));
  },
});

const providerRequired = (_req: Request, res: Response): void => {
  res.status(501).json({
    code: 'PROVIDER_INTEGRATION_REQUIRED',
    error: 'Для операции требуется подключение внешнего провайдера',
  });
};

const iinSchema = z.object({ iin: z.string().trim().min(1).max(64) }).strict();
const scenarioChangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('increase_down_payment'), additionalDownPayment: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal('close_obligation'), facilityFingerprint: z.string().min(1).max(200), payoffVerified: z.boolean() }).strict(),
  z.object({ type: z.literal('refinance_high_rate_debt'), facilityFingerprint: z.string().min(1).max(200), verifiedOffer: z.boolean(), newMonthlyPayment: z.string().min(1).max(64), totalCostDifference: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal('partial_early_repayment'), facilityFingerprint: z.string().min(1).max(200), verifiedSchedule: z.boolean(), recalculationMode: z.enum(['reduce_payment', 'reduce_term']), newMonthlyPayment: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal('increase_confirmed_income'), fingerprint: z.string().min(1).max(200), amount: z.string().min(1).max(64), verified: z.boolean(), programAcceptanceStatus: z.enum(['ACCEPTED', 'REJECTED', 'UNKNOWN']) }).strict(),
  z.object({ type: z.literal('lower_property_budget'), newPropertyPrice: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal('wait_for_history'), targetDate: z.string().datetime(), reason: z.string().min(1).max(500) }).strict(),
]);
const scenarioSchema = z.object({ changes: z.array(scenarioChangeSchema).max(3) }).strict();

mortgageWorkspaceRouter.get('/sandbox/status', (_req: Request, res: Response): void => {
  res.json(getSandboxStatus());
});

mortgageWorkspaceRouter.post('/sandbox/iin-check', (req: Request, res: Response): void => {
  const parsed = iinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', error: 'Некорректный формат запроса' });
    return;
  }
  res.json(checkSandboxIin(parsed.data.iin));
});

mortgageWorkspaceRouter.get('/sandbox/analysis', (_req: Request, res: Response): void => {
  res.json(getSandboxAnalysis());
});

mortgageWorkspaceRouter.post('/sandbox/scenarios', (req: Request, res: Response): void => {
  const parsed = scenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'SCENARIO_INPUT_INVALID', error: 'Некорректные параметры сценария' });
    return;
  }
  try {
    res.json(previewSandboxScenario(parsed.data.changes as MortgageScenarioChange[]));
  } catch (error) {
    res.status(400).json({
      code: 'SCENARIO_INPUT_INVALID',
      error: error instanceof Error ? error.message : 'Некорректные параметры сценария',
    });
  }
});

// Backward-compatible synthetic calculations. They contain no external claims.
mortgageWorkspaceRouter.get('/demo/analysis', (_req: Request, res: Response): void => {
  res.json(demoAnalysis());
});
mortgageWorkspaceRouter.get('/demo/properties', (_req: Request, res: Response): void => {
  res.json(demoProperties());
});

const whatIfSchema = z.object({
  propertyPrice: z.number().nonnegative(),
  downPayment: z.number().nonnegative(),
  termMonths: z.number().int().positive(),
  rate: z.number().nonnegative(),
  existingDebtPayment: z.number().nonnegative().default(DEMO_EXISTING_PAYMENT),
  additionalConfirmedIncome: z.number().default(0),
  baseIncome: z.number().positive().default(DEMO_BASE_INCOME),
});

mortgageWorkspaceRouter.post('/whatif', (req: Request, res: Response): void => {
  const parsed = whatIfSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', error: 'Ошибка валидации', details: parsed.error.errors });
    return;
  }
  res.json(computeWhatIf(parsed.data));
});

// SMS consent and public conclusion links require real providers/contracts.
mortgageWorkspaceRouter.post('/consents', providerRequired);
mortgageWorkspaceRouter.get('/consents/:token', providerRequired);
mortgageWorkspaceRouter.post('/conclusions', providerRequired);

mortgageWorkspaceRouter.post(
  '/documents',
  pdfUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      const type = String(req.body?.type || '') as MortgageDocType;
      if (!file) {
        res.status(400).json({ code: 'FILE_REQUIRED', error: 'Файл не получен (поле file)' });
        return;
      }
      if (type !== 'credit_history' && type !== 'enpf_statement') {
        res.status(400).json({ code: 'DOCUMENT_TYPE_INVALID', error: 'Укажите type: credit_history или enpf_statement' });
        return;
      }

      let text: string;
      try {
        text = await extractTextFromPdf(file.buffer);
      } catch {
        res.status(422).json({ code: 'TEXT_LAYER_REQUIRED', error: 'Не удалось извлечь текстовый слой PDF' });
        return;
      }

      const policy = inspectMortgageSandboxPdf({
        buffer: file.buffer,
        extractedText: text,
        attestedSynthetic: req.body?.syntheticAttestation === 'true',
      });
      if (!policy.allowed) {
        res.status(422).json({ code: policy.code, error: 'Документ не соответствует политике безопасного sandbox' });
        return;
      }

      const extraction = extractDocument(type, text);
      const sha256 = sha256Of(file.buffer);
      const id = newDocumentId();
      const meta: StoredDocumentMeta = {
        id,
        type,
        fileName: file.originalname || `${type}.pdf`,
        size: file.size,
        sha256,
        status: 'needs_review',
        uploadedBy: req.user?.userId,
        caseRef: typeof req.body?.caseRef === 'string' ? req.body.caseRef : undefined,
        storedAt: new Date().toISOString(),
        sandbox: true,
        policyVersion: policy.policyVersion,
        extraction,
      };
      saveDocument(file.buffer, meta);

      res.status(201).json({
        id, type, fileName: meta.fileName, size: meta.size, sha256,
        status: meta.status, storedAt: meta.storedAt, stored: true,
        sandbox: true, policyVersion: policy.policyVersion, extraction,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обработать документ';
      res.status(500).json({ error: message });
    }
  },
);

mortgageWorkspaceRouter.get('/documents/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!isValidId(id)) { res.status(400).json({ error: 'Некорректный id' }); return; }
  const meta = readMeta(id);
  if (!meta || !canAccessDocument(meta, req.user)) { res.status(404).json({ error: 'Документ не найден' }); return; }
  res.json(meta);
});

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

function hasUnresolvedCriticalFields(extraction: unknown): boolean {
  if (!extraction || typeof extraction !== 'object') return true;
  const fields = (extraction as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return true;
  const resolved = new Set(['PRESENT', 'EXPLICIT_ZERO', 'NOT_APPLICABLE']);
  return fields.some((field) => {
    if (!field || typeof field !== 'object') return true;
    const item = field as { critical?: unknown; presence?: unknown };
    return item.critical === true && (typeof item.presence !== 'string' || !resolved.has(item.presence));
  });
}

mortgageWorkspaceRouter.patch('/documents/:id/confirm', (req: Request, res: Response): void => {
  const { id } = req.params;
  if (!isValidId(id)) { res.status(400).json({ error: 'Некорректный id' }); return; }
  const meta = readMeta(id);
  if (!meta || !canAccessDocument(meta, req.user)) { res.status(404).json({ error: 'Документ не найден' }); return; }
  if (hasUnresolvedCriticalFields(meta.extraction)) {
    res.status(409).json({ code: 'CRITICAL_FIELDS_UNRESOLVED', error: 'Критичные поля требуют проверки' });
    return;
  }
  const updated = updateMeta(id, { status: 'confirmed' });
  if (!updated) { res.status(404).json({ error: 'Документ не найден' }); return; }
  res.json({ id, status: updated.status });
});

export default mortgageWorkspaceRouter;
