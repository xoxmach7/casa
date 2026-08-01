import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Доступ запрещен' });
        return;
      }
      next();
    },
}));

vi.mock('../services/file-storage.service', () => ({
  fileStorageService: { uploadFile: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { fileStorageService } from '../services/file-storage.service';
import { uploadsRouter } from '../routes/uploads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/uploads', uploadsRouter);
  return app;
}

const REAL_JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('fake-jpg-body')]);
const REAL_PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.from('fake-pdf-body')]);

describe('POST /api/uploads/property/:id/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('rejects a non-image file spoofed with an image mimetype/extension', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'prop_1', images: [] });

    const app = buildApp();
    const res = await request(app)
      .post('/api/uploads/property/prop_1/images')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(fileStorageService.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads a real image and appends its URL to the property', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'prop_1', images: ['/uploads/existing.jpg'] });
    (prisma.crmProperty.update as any).mockResolvedValue({ images: ['/uploads/existing.jpg', '/uploads/new.jpg'] });
    (fileStorageService.uploadFile as any).mockResolvedValue('/uploads/new.jpg');

    const app = buildApp();
    const res = await request(app)
      .post('/api/uploads/property/prop_1/images')
      .attach('file', REAL_JPEG_BYTES, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(fileStorageService.uploadFile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^properties\/prop_1\/\d+\.jpg$/)
    );
  });

  it('403s for a non-broker/admin role', async () => {
    currentUser = { userId: 'client_1', role: 'REALTOR' };

    const app = buildApp();
    const res = await request(app)
      .post('/api/uploads/property/prop_1/images')
      .attach('file', REAL_JPEG_BYTES, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/uploads/property/missing/images')
      .attach('file', REAL_JPEG_BYTES, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/uploads/property/:id/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('rejects a non-document file spoofed with a PDF mimetype/extension', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/uploads/property/prop_1/documents')
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'contract.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(fileStorageService.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads a real PDF and appends its URL to the property', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'prop_1', documents: [] });
    (prisma.crmProperty.update as any).mockResolvedValue({ documents: ['/uploads/new.pdf'] });
    (fileStorageService.uploadFile as any).mockResolvedValue('/uploads/new.pdf');

    const app = buildApp();
    const res = await request(app)
      .post('/api/uploads/property/prop_1/documents')
      .attach('file', REAL_PDF_BYTES, { filename: 'contract.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(fileStorageService.uploadFile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^properties\/prop_1\/docs\/\d+\.pdf$/)
    );
  });
});

describe('DELETE /api/uploads/property/:id/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('removes the given URL from the images array', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({
      id: 'prop_1',
      images: ['/uploads/a.jpg', '/uploads/b.jpg'],
    });
    (prisma.crmProperty.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .delete('/api/uploads/property/prop_1/images')
      .send({ url: '/uploads/a.jpg' });

    expect(res.status).toBe(200);
    expect(prisma.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { images: ['/uploads/b.jpg'] },
    });
  });
});
