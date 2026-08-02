import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import { usersAdminRouter } from './routes/users.admin.routes';
import { clientsRouter } from './routes/clients.routes';
import { projectsRouter } from './routes/projects.routes';
import { apartmentsRouter } from './routes/apartments.routes';
import { bookingsRouter } from './routes/bookings.routes';
import { mortgageRouter } from './routes/mortgage.routes';
import { coursesRouter } from './routes/courses.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { mortgageProgramsRouter } from './routes/mortgage-programs.routes';
import { dealsRouter } from './routes/deals.routes';
import { commissionsRouter } from './routes/commissions.routes';
import { dealAgentRouter } from './routes/deal-agent.routes';
import { runDealAgent } from './lib/deal-agent-runner';
import { tasksRouter } from './routes/tasks.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { uploadRouter } from './routes/upload.routes';
import { paymentsRouter } from './routes/payments.routes';
import { formsRouter } from './routes/forms.routes';
import { publicFormsRouter } from './routes/public-forms.routes';
import { publicValuationRouter } from './routes/public-valuation.routes';
import { publicPropertiesRouter } from './routes/public-properties.routes';
import { publicViewingRequestsRouter } from './routes/public-viewing-requests.routes';
import { publicPropertyLeadsRouter } from './routes/public-property-leads.routes';
import { publicSelectionsRouter } from './routes/public-selections.routes';
import { publicBuyerLeadsRouter } from './routes/public-buyer-leads.routes';
import { publicUploadsRouter } from './routes/public-uploads.routes';
import { sellersRouter } from './routes/sellers.routes';
import { crmPropertiesRouter } from './routes/crm-properties.routes';
import { buyersRouter } from './routes/buyers.routes';
import { selectionsRouter } from './routes/selections.routes';
import { fixationsRouter } from './routes/fixations.routes';
import { valuationsRouter } from './routes/valuations.routes';
import { clientPropertyInterestsRouter } from './routes/client-property-interests.routes';
import { dealRoomRouter } from './routes/deal-room.routes';
import { scoringRouter } from './routes/scoring.routes';
import { uploadsRouter } from './routes/uploads.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { settingsRouter } from './routes/settings.routes';
import { moderationRouter } from './routes/moderation.routes';
import { searchRouter } from './routes/search.routes';
import { customFunnelsRouter } from './routes/custom-funnels.routes';
import { customFieldsRouter } from './routes/custom-fields.routes';
import { agencyRouter } from './routes/agency.routes';
import { eventsRouter } from './routes/events.routes';
import { exportRouter } from './routes/export.routes';
import { importRouter } from './routes/import.routes';
import { subscriptionsRouter } from './routes/subscriptions.routes';
import { mortgageApplicationsRouter } from './routes/mortgage-applications.routes';
import { errorHandler } from './middleware/error.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { prisma } from './lib/prisma';
import { initializeBucket } from './lib/minio';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Railway (and most PaaS hosts) sit behind exactly one reverse proxy hop —
// trust it so express-rate-limit can read the real client IP from
// X-Forwarded-For instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(auditMiddleware);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', async (_req, res) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      db: 'disconnected',
    });
  }
});

// API Routes

// Global API rate limiter — 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api', globalLimiter);

// Strict limiter for login — 20 attempts per 15 min (relaxed in dev for testing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 20,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin/users', usersAdminRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/apartments', apartmentsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/mortgage', mortgageRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/mortgage-programs', mortgageProgramsRouter);
// Mounted before dealsRouter so /api/deals/agent/* is matched unambiguously,
// rather than relying on dealsRouter's own routes (e.g. GET '/:id') failing
// to match first.
app.use('/api/deals/agent', dealAgentRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/commissions', commissionsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/upload', uploadRouter);       // MinIO / general file uploads
app.use('/api/payments', paymentsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/public/forms', publicFormsRouter);
app.use('/api/public/valuation', publicValuationRouter);
app.use('/api/public/properties', publicPropertiesRouter);
app.use('/api/public/viewing-requests', publicViewingRequestsRouter);
app.use('/api/public/property-leads', publicPropertyLeadsRouter);
app.use('/api/public/buyer-leads', publicBuyerLeadsRouter);
app.use('/api/public/selections', publicSelectionsRouter);
app.use('/api/public/uploads', publicUploadsRouter);

// CASA CRM Routes
app.use('/api/sellers', sellersRouter);
app.use('/api/crm-properties', crmPropertiesRouter);
app.use('/api/buyers', buyersRouter);
app.use('/api/selections', selectionsRouter);
app.use('/api/fixations', fixationsRouter);
app.use('/api/valuations', valuationsRouter);
app.use('/api/client-property-interests', clientPropertyInterestsRouter);
app.use('/api/deal-room', dealRoomRouter);
app.use('/api/scoring', scoringRouter);
app.use('/api/uploads', uploadsRouter);     // CRM property image/document uploads (local storage)
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/admin/moderation', moderationRouter);
app.use('/api/admin/search', searchRouter);
app.use('/api/custom-funnels', customFunnelsRouter);
app.use('/api/custom-fields', customFieldsRouter);
app.use('/api/agency', agencyRouter);
app.use('/api/events', eventsRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/mortgage-applications', mortgageApplicationsRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);

  // Initialize MinIO bucket
  await initializeBucket();

  // Self health-check every 15 minutes
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[Health] OK — ${new Date().toISOString()}`);
    } catch (e) {
      console.error(`[Health] DB connection failed — ${new Date().toISOString()}`, e);
    }
  }, 15 * 60 * 1000);

  // ИИ-риелтор: раз в час проверяет активные сделки на застой (см. deal-agent-runner.ts)
  setInterval(async () => {
    try {
      const stats = await runDealAgent();
      console.log(`[DealAgent] checked=${stats.checkedDeals} stalled=${stats.stalledCount} suggested=${stats.suggestedCount} — ${new Date().toISOString()}`);
    } catch (e) {
      console.error(`[DealAgent] run failed — ${new Date().toISOString()}`, e);
    }
  }, 60 * 60 * 1000);
});
