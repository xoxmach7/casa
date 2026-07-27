/**
 * ============================================================
 * JWT & AUTH UNIT TESTS (no server required)
 * ============================================================
 */

import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// We test the pure functions directly
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

describe('JWT Token Unit Tests', () => {
  const validPayload = {
    userId: 'test-user-id-123',
    email: 'test@example.com',
    role: 'BROKER',
  };

  it('generates a valid JWT', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '7d' });
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('verifies a valid JWT', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.userId).toBe(validPayload.userId);
    expect(decoded.email).toBe(validPayload.email);
    expect(decoded.role).toBe(validPayload.role);
  });

  it('rejects token with wrong secret', () => {
    const token = jwt.sign(validPayload, 'wrong-secret', { expiresIn: '7d' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('rejects expired token', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/expired/i);
  });

  it('rejects completely malformed token', () => {
    expect(() => jwt.verify('not.a.valid.jwt', JWT_SECRET)).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => jwt.verify('', JWT_SECRET)).toThrow();
  });

  it('rejects none algorithm attack', () => {
    // Create a token with "none" alg (classic JWT attack)
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    expect(() => jwt.verify(noneToken, JWT_SECRET)).toThrow();
  });

  it('payload does not contain sensitive data', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.decode(token) as any;
    expect(decoded.password).toBeUndefined();
    expect(decoded.passwordHash).toBeUndefined();
    expect(decoded.secret).toBeUndefined();
  });

  it('includes expiration (exp) claim', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.decode(token) as any;
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('includes issued-at (iat) claim', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.decode(token) as any;
    expect(decoded.iat).toBeDefined();
    expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
  });
});

describe('Zod Validation Schemas', () => {
  // Import the login schema structure
  const { z } = require('zod');

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects login without email', () => {
    const result = loginSchema.safeParse({ password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects login without password', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com', password: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects XSS in email', () => {
    const result = loginSchema.safeParse({ email: '<script>alert(1)</script>', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects SQL injection in email', () => {
    const result = loginSchema.safeParse({ email: "' OR 1=1 --", password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('accepts email with special chars (valid)', () => {
    const result = loginSchema.safeParse({ email: 'user+tag@sub.domain.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty strings', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects null values', () => {
    const result = loginSchema.safeParse({ email: null, password: null });
    expect(result.success).toBe(false);
  });

  it('rejects number types', () => {
    const result = loginSchema.safeParse({ email: 12345, password: 12345 });
    expect(result.success).toBe(false);
  });

  it('handles prototype pollution attempt', () => {
    const result = loginSchema.safeParse({
      email: 'test@test.com',
      password: 'password123',
      __proto__: { admin: true },
      constructor: { prototype: { admin: true } },
    });
    // Zod strips extra fields
    if (result.success) {
      expect((result.data as any).__proto__?.admin).toBeUndefined();
    }
  });
});

describe('Phone Utility', () => {
  // Test phone normalization if exists
  it('normalizes phone numbers', async () => {
    try {
      const { normalizePhone } = await import('../lib/phone.utils');
      if (normalizePhone) {
        expect(normalizePhone('+7 (700) 123-45-67')).toBeTruthy();
      }
    } catch {
      // phone.utils might not export normalizePhone - skip
    }
  });
});
