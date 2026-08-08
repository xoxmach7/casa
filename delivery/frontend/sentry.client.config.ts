// Loaded automatically by the Sentry webpack plugin for the browser bundle.
// Inert until NEXT_PUBLIC_SENTRY_DSN is set — client DSNs are meant to be
// public (that's how browser error reporting works), server/edge use the
// unprefixed SENTRY_DSN instead (see sentry.server.config.ts).
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}
