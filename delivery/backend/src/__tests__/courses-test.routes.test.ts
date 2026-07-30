import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  auth: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'BROKER' };
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    courseTest: { findUnique: vi.fn() },
    testAttempt: { create: vi.fn() },
    courseProgress: { upsert: vi.fn(), findMany: vi.fn() },
    course: { findMany: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { coursesRouter } from '../routes/courses.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  return app;
}

const QUESTIONS = [
  { question: 'Q1', options: ['a', 'b'], correctIndex: 0 },
  { question: 'Q2', options: ['a', 'b'], correctIndex: 1 },
];

describe('GET /api/courses/:id/test', () => {
  beforeEach(() => vi.clearAllMocks());

  it('strips correctIndex from the returned questions', async () => {
    (prisma.courseTest.findUnique as any).mockResolvedValue({
      id: 'test_1',
      courseId: 'course_1',
      passScore: 70,
      questions: QUESTIONS,
    });

    const app = buildApp();
    const res = await request(app).get('/api/courses/course_1/test');

    expect(res.status).toBe(200);
    expect(res.body.questions).toEqual([
      { question: 'Q1', options: ['a', 'b'] },
      { question: 'Q2', options: ['a', 'b'] },
    ]);
  });

  it('404s when the course has no test', async () => {
    (prisma.courseTest.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/courses/course_1/test');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/courses/:id/test/submit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grades the attempt, records it, and completes the course on a pass', async () => {
    (prisma.courseTest.findUnique as any).mockResolvedValue({
      id: 'test_1',
      courseId: 'course_1',
      passScore: 70,
      questions: QUESTIONS,
    });
    (prisma.testAttempt.create as any).mockResolvedValue({});
    (prisma.courseProgress.upsert as any).mockResolvedValue({});
    (prisma.course.findMany as any).mockResolvedValue([{ id: 'course_1' }]);
    (prisma.courseProgress.findMany as any).mockResolvedValue([{ courseId: 'course_1' }]);

    const app = buildApp();
    const res = await request(app).post('/api/courses/course_1/test/submit').send({ answers: [0, 1] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ score: 100, passed: true });
    expect(prisma.testAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ testId: 'test_1', userId: 'broker_1', score: 100, passed: true }) })
    );
    expect(prisma.courseProgress.upsert).toHaveBeenCalled();
    // Only active course is now completed -> certification check fires.
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'broker_1' }, data: { certificationStatus: 'CERTIFIED' } })
    );
  });

  it('does not complete the course or certify on a failing score', async () => {
    (prisma.courseTest.findUnique as any).mockResolvedValue({
      id: 'test_1',
      courseId: 'course_1',
      passScore: 70,
      questions: QUESTIONS,
    });
    (prisma.testAttempt.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/courses/course_1/test/submit').send({ answers: [1, 0] }); // 0/2 correct

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ score: 0, passed: false });
    expect(prisma.courseProgress.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not certify when other active courses are still incomplete', async () => {
    (prisma.courseTest.findUnique as any).mockResolvedValue({
      id: 'test_1',
      courseId: 'course_1',
      passScore: 70,
      questions: QUESTIONS,
    });
    (prisma.testAttempt.create as any).mockResolvedValue({});
    (prisma.courseProgress.upsert as any).mockResolvedValue({});
    (prisma.course.findMany as any).mockResolvedValue([{ id: 'course_1' }, { id: 'course_2' }]);
    (prisma.courseProgress.findMany as any).mockResolvedValue([{ courseId: 'course_1' }]);

    const app = buildApp();
    const res = await request(app).post('/api/courses/course_1/test/submit').send({ answers: [0, 1] });

    expect(res.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
