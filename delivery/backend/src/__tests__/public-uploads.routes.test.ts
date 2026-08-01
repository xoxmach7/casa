import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../services/file-storage.service', () => ({
  fileStorageService: {
    uploadFile: vi.fn(),
  },
}));

import { fileStorageService } from '../services/file-storage.service';
import { publicUploadsRouter } from '../routes/public-uploads.routes';

function buildApp() {
  const app = express();
  app.use('/api/public/uploads', publicUploadsRouter);
  return app;
}

const REAL_JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('fake-jpg-body')]);
const REAL_PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake-png-body'),
]);

describe('POST /api/public/uploads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s when no files are attached', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/uploads');
    expect(res.status).toBe(400);
  });

  it('uploads each attached image and returns their URLs', async () => {
    (fileStorageService.uploadFile as any)
      .mockResolvedValueOnce('/uploads/property-leads/a.jpg')
      .mockResolvedValueOnce('/uploads/property-leads/b.jpg');

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/uploads')
      .attach('files', REAL_JPEG_BYTES, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('files', REAL_PNG_BYTES, { filename: 'b.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      urls: ['/uploads/property-leads/a.jpg', '/uploads/property-leads/b.jpg'],
    });
    expect(fileStorageService.uploadFile).toHaveBeenCalledTimes(2);
  });

  it('rejects a disallowed file type', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/public/uploads')
      .attach('files', Buffer.from('not an image'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
    expect(fileStorageService.uploadFile).not.toHaveBeenCalled();
  });

  it('rejects a non-image file spoofed with an image mimetype and extension', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/public/uploads')
      .attach('files', Buffer.from('<script>alert(document.cookie)</script>'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(fileStorageService.uploadFile).not.toHaveBeenCalled();
  });
});
