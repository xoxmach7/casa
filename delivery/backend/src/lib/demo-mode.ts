/** Demo-only routes are available outside production, unless explicitly opted in. */
export function demoEndpointsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_ENDPOINTS === 'true';
}
