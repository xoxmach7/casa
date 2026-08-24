import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } | null = { userId: 'owner_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    req.user = currentUser;
    next();
  },
}));

const documentStore = vi.hoisted(() => ({
  saveDocument: vi.fn(), readMeta: vi.fn(), readPdf: vi.fn(), updateMeta: vi.fn(),
  isValidId: vi.fn(() => true),
  canAccessDocument: vi.fn((meta: any, user: any) => Boolean(user && (user.role === 'ADMIN' || meta.uploadedBy === user.userId))),
  newDocumentId: vi.fn(() => 'a'.repeat(32)),
  sha256Of: vi.fn(() => 'hash-only-diagnostic'),
}));

vi.mock('../lib/mortgage-workspace/document-store', () => documentStore);
vi.mock('../lib/scoring-document.service', () => ({
  extractTextFromPdf: vi.fn(async () => 'Синтетическая выписка без персональных данных для ипотечного sandbox'),
}));
vi.mock('../lib/mortgage-workspace/extraction', () => ({
  extractDocument: vi.fn(() => ({
    docType: 'credit_history', template: 'SYNTHETIC', supported: true,
    statuses: { file_integrity: 'VALID', authenticity: 'MANUAL_REVIEW_REQUIRED', extraction: 'OK' },
    fields: [{ key: 'bureau', presence: 'PRESENT', critical: true }],
    derived: {}, gates: [], notes: [], reviewRequired: true, textChars: 64,
  })),
}));

import { mortgageWorkspaceRouter } from '../routes/mortgage-workspace.routes';
import { publicMortgageRouter } from '../routes/public-mortgage.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/mortgage-workspace', mortgageWorkspaceRouter);
  app.use('/api/public/mortgage', publicMortgageRouter);
  return app;
}

describe('mortgage workspace production sandbox routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'owner_1', role: 'BROKER' };
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEMO_ENDPOINTS;
  });

  it('requires authentication but does not require ENABLE_DEMO_ENDPOINTS', async () => {
    currentUser = null;
    expect((await request(buildApp()).get('/api/mortgage-workspace/sandbox/status')).status).toBe(401);
    currentUser = { userId: 'owner_1', role: 'BROKER' };
    const response = await request(buildApp()).get('/api/mortgage-workspace/sandbox/status');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ mode: 'synthetic', officialIinCheck: false });
  });

  it('keeps public mortgage demo routes fail-closed in production', async () => {
    expect((await request(buildApp()).get('/api/public/mortgage/consent/token')).status).toBe(404);
  });

  it('returns truthful IIN status and deterministic core analysis/scenarios', async () => {
    const app = buildApp();
    const iin = await request(app).post('/api/mortgage-workspace/sandbox/iin-check').send({ iin: '900101300017' });
    expect(iin.status).toBe(200);
    expect(iin.body).toMatchObject({ checksumValid: true, externalSourceStatus: 'EXTERNAL_SOURCE_NOT_CONNECTED', officialResult: null });
    const analysis = await request(app).get('/api/mortgage-workspace/sandbox/analysis');
    expect(analysis.status).toBe(200);
    expect(analysis.body.analysis.assessments.length).toBeGreaterThan(0);
    const scenario = await request(app).post('/api/mortgage-workspace/sandbox/scenarios').send({
      changes: [{ type: 'increase_down_payment', additionalDownPayment: '2000000' }],
    });
    expect(scenario.status).toBe(200);
    expect(scenario.body.scenario.snapshot.property.downPaymentCash).toBe('10000000');
  });

  it.each(['/consents', '/conclusions'])('gates provider-backed legacy endpoint %s', async (path) => {
    const response = await request(buildApp()).post(`/api/mortgage-workspace${path}`).send({});
    expect(response.status).toBe(501);
    expect(response.body.code).toBe('PROVIDER_INTEGRATION_REQUIRED');
  });

  it('rejects an unsafe upload before persistence', async () => {
    const response = await request(buildApp()).post('/api/mortgage-workspace/documents')
      .field('type', 'credit_history').field('syntheticAttestation', 'true')
      .attach('file', Buffer.from('not-pdf'), { filename: 'unsafe.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PDF_SIGNATURE_INVALID');
    expect(documentStore.saveDocument).not.toHaveBeenCalled();
    expect(documentStore.newDocumentId).not.toHaveBeenCalled();
  });

  it('persists accepted synthetic PDF with sandbox policy metadata', async () => {
    const response = await request(buildApp()).post('/api/mortgage-workspace/documents')
      .field('type', 'credit_history').field('syntheticAttestation', 'true')
      .attach('file', Buffer.from('%PDF-1.7 synthetic'), { filename: 'synthetic.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(201);
    expect(documentStore.saveDocument).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
      sandbox: true, policyVersion: '2026-08-24', uploadedBy: 'owner_1', sha256: 'hash-only-diagnostic',
    }));
  });

  it('enforces owner/admin access and rejects unresolved critical confirmation', async () => {
    documentStore.readMeta.mockReturnValue({
      id: 'a'.repeat(32), uploadedBy: 'owner_1', fileName: 'x.pdf', status: 'needs_review',
      extraction: { fields: [{ key: 'bureau', critical: true, presence: 'UNKNOWN' }] },
    });
    currentUser = { userId: 'other_1', role: 'BROKER' };
    expect((await request(buildApp()).get(`/api/mortgage-workspace/documents/${'a'.repeat(32)}`)).status).toBe(404);
    expect((await request(buildApp()).patch(`/api/mortgage-workspace/documents/${'a'.repeat(32)}/confirm`)).status).toBe(404);
    currentUser = { userId: 'owner_1', role: 'BROKER' };
    const unresolved = await request(buildApp()).patch(`/api/mortgage-workspace/documents/${'a'.repeat(32)}/confirm`);
    expect(unresolved.status).toBe(409);
    expect(unresolved.body.code).toBe('CRITICAL_FIELDS_UNRESOLVED');
    expect(documentStore.updateMeta).not.toHaveBeenCalled();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    expect((await request(buildApp()).get(`/api/mortgage-workspace/documents/${'a'.repeat(32)}`)).status).toBe(200);
  });
});
