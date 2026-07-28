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
      .attach('files', Buffer.from('fake-jpg-bytes'), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('files', Buffer.from('fake-png-bytes'), { filename: 'b.png', contentType: 'image/png' });

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
});
