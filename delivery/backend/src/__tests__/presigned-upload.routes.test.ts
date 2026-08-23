import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const presignedPutObject = vi.fn();
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user_1', role: 'BROKER' };
    next();
  },
}));
vi.mock('../lib/minio', () => ({
  minioClient: { presignedPutObject },
  MINIO_BUCKET: 'bucket',
  getPublicUrl: vi.fn(),
}));

import { uploadRouter } from '../routes/upload.routes';

it('does not issue a public presigned upload URL', async () => {
  const app = express();
  app.use('/api/upload', uploadRouter);
  const res = await request(app).get('/api/upload/presigned/images?filename=evil.html');
  expect(res.status).toBe(501);
  expect(presignedPutObject).not.toHaveBeenCalled();
});
