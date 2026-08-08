// Must be imported before any other module (see src/index.ts) so Sentry can
// instrument Express/Prisma/etc. Inert until SENTRY_DSN is set — no DSN,
// no telemetry, no behavior change.
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}
