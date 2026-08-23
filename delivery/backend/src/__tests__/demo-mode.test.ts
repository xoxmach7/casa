import { describe, it, expect, afterEach } from 'vitest';
import { demoEndpointsEnabled } from '../lib/demo-mode';

describe('demo endpoint runtime guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ENABLE_DEMO_ENDPOINTS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.ENABLE_DEMO_ENDPOINTS;
    else process.env.ENABLE_DEMO_ENDPOINTS = originalFlag;
  });

  it('fails closed in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEMO_ENDPOINTS;
    expect(demoEndpointsEnabled()).toBe(false);
    process.env.ENABLE_DEMO_ENDPOINTS = 'true';
    expect(demoEndpointsEnabled()).toBe(true);
  });
});
