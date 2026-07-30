import { Router } from 'express';
import { auth } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { isEligibleForCertification, gradeTest } from '../lib/certification.service';

const router = Router();

async function maybeCertifyUser(userId: string): Promise<void> {
    const [activeCourses, completedProgress] = await Promise.all([
        prisma.course.findMany({ where: { isActive: true }, select: { id: true } }),
        prisma.courseProgress.findMany({ where: { userId, isCompleted: true }, select: { courseId: true } }),
    ]);

    const eligible = isEligibleForCertification(
        activeCourses.map((c) => c.id),
        completedProgress.map((p) => p.courseId)
    );

    if (eligible) {
        await prisma.user.update({ where: { id: userId }, data: { certificationStatus: 'CERTIFIED' } });
    }
}

// Get all courses (admin)
router.get('/', auth, async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
        return res.json(courses);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get my assigned courses (broker)
router.get('/my', auth, async (req, res) => {
    try {
        const progress = await prisma.courseProgress.findMany({
            where: { userId: req.user!.userId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        content: true,
                        duration: true,
                        videoUrl: true,
                        materials: true,
                        checklist: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Transform to expected format
        const courses = progress.map(p => ({
            id: p.course.id,
            title: p.course.title,
            description: p.course.description || '',
            content: p.course.content,
            duration: p.course.duration,
            videoUrl: p.course.videoUrl,
            materials: p.course.materials,
            checklist: p.course.checklist,
            completed: p.isCompleted,
            progressPercent: p.progressPercent,
            completedAt: p.completedAt?.toISOString(),
            assignedAt: p.createdAt.toISOString(),
        }));

        return res.json({ courses });
    } catch (error) {
        console.error('Error fetching courses:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get single course
router.get('/:id', auth, async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
        });

        if (!course) {
            return res.status(404).json({ error: 'Курс не найден' });
        }

        return res.json(course);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Mark course as completed/incomplete (broker)
router.put('/:courseId/complete', auth, async (req, res) => {
    try {
        const { completed } = req.body;
        const { courseId } = req.params;

        const progress = await prisma.courseProgress.update({
            where: {
                userId_courseId: {
                    userId: req.user!.userId,
                    courseId,
                },
            },
            data: {
                isCompleted: completed,
                completedAt: completed ? new Date() : null,
                progressPercent: completed ? 100 : 0,
            },
        });

        if (completed) await maybeCertifyUser(req.user!.userId);

        return res.json(progress);
    } catch (error) {
        console.error('Error updating course completion:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// GET /api/courses/:id/test - вопросы теста без правильных ответов
router.get('/:id/test', auth, async (req, res) => {
    try {
        const test = await prisma.courseTest.findUnique({ where: { courseId: req.params.id } });
        if (!test) {
            return res.status(404).json({ error: 'Тест для этого курса не найден' });
        }

        const questions = (test.questions as any[]).map(({ correctIndex, ...q }) => q);
        return res.json({ id: test.id, courseId: test.courseId, passScore: test.passScore, questions });
    } catch (error) {
        console.error('Error fetching course test:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /api/courses/:id/test/submit - сдать тест; при прохождении закрывает
// курс и, если это был последний активный курс, сертифицирует пользователя.
router.post('/:id/test/submit', auth, async (req, res) => {
    try {
        const { answers } = req.body as { answers: number[] };
        const test = await prisma.courseTest.findUnique({ where: { courseId: req.params.id } });
        if (!test) {
            return res.status(404).json({ error: 'Тест для этого курса не найден' });
        }

        const questions = test.questions as { correctIndex: number }[];
        const { score, passed } = gradeTest(questions, answers || [], test.passScore);

        await prisma.testAttempt.create({
            data: { testId: test.id, userId: req.user!.userId, score, passed, answers: answers || [] },
        });

        if (passed) {
            await prisma.courseProgress.upsert({
                where: { userId_courseId: { userId: req.user!.userId, courseId: req.params.id } },
                update: { isCompleted: true, completedAt: new Date(), progressPercent: 100 },
                create: {
                    userId: req.user!.userId,
                    courseId: req.params.id,
                    isCompleted: true,
                    completedAt: new Date(),
                    progressPercent: 100,
                },
            });
            await maybeCertifyUser(req.user!.userId);
        }

        return res.json({ score, passed });
    } catch (error) {
        console.error('Error submitting course test:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get user's course progress (legacy)
router.get('/progress/my', auth, async (req, res) => {
    try {
        const progress = await prisma.courseProgress.findMany({
            where: { userId: req.user!.userId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        duration: true,
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        return res.json(progress);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Update course progress
router.put('/progress/:courseId', auth, async (req, res) => {
    try {
        const { progressPercent, isCompleted } = req.body;
        const { courseId } = req.params;

        const progress = await prisma.courseProgress.upsert({
            where: {
                userId_courseId: {
                    userId: req.user!.userId,
                    courseId,
                },
            },
            update: {
                progressPercent,
                isCompleted,
                completedAt: isCompleted ? new Date() : null,
            },
            create: {
                userId: req.user!.userId,
                courseId,
                progressPercent,
                isCompleted,
                completedAt: isCompleted ? new Date() : null,
            },
        });

        if (isCompleted) await maybeCertifyUser(req.user!.userId);

        return res.json(progress);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========= ADMIN Routes =========

// Create course (admin)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { title, description, content, duration, order } = req.body;

        const course = await prisma.course.create({
            data: {
                title,
                description,
                content: content || '',
                duration: duration || 60,
                order: order || 0,
            },
        });

        return res.status(201).json(course);
    } catch (error) {
        console.error('Error creating course:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Update course (admin)
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { title, description, content, duration, order, isActive } = req.body;

        const course = await prisma.course.update({
            where: { id: req.params.id },
            data: {
                title,
                description,
                content,
                duration,
                order,
                isActive,
            },
        });

        return res.json(course);
    } catch (error) {
        console.error('Error updating course:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Assign course to broker (admin)
router.post('/assign', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { courseId, brokerId } = req.body;

        // Check if already assigned
        const existing = await prisma.courseProgress.findUnique({
            where: {
                userId_courseId: {
                    userId: brokerId,
                    courseId,
                },
            },
        });

        if (existing) {
            return res.status(400).json({ error: 'Курс уже назначен этому брокеру' });
        }

        const progress = await prisma.courseProgress.create({
            data: {
                userId: brokerId,
                courseId,
                progressPercent: 0,
                isCompleted: false,
            },
        });

        return res.status(201).json(progress);
    } catch (error) {
        console.error('Error assigning course:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Unassign course from broker (admin)
router.delete('/assign/:brokerId/:courseId', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { brokerId, courseId } = req.params;

        await prisma.courseProgress.delete({
            where: {
                userId_courseId: {
                    userId: brokerId,
                    courseId,
                },
            },
        });

        return res.json({ message: 'Курс удален' });
    } catch (error) {
        console.error('Error unassigning course:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get broker's courses (admin)
router.get('/broker/:brokerId', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const progress = await prisma.courseProgress.findMany({
            where: { userId: req.params.brokerId },
            include: {
                course: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return res.json(progress);
    } catch (error) {
        console.error('Error fetching broker courses:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export { router as coursesRouter };
