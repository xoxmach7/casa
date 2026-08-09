import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseJwt, isTokenExpired, getToken, clearAuthAndRedirect } from './auth-utils';

/**
 * Builds an unsigned JWT — parseJwt never verifies the signature. Claims are
 * UTF-8 encoded before base64 exactly like a real signer does, otherwise btoa
 * chokes on Cyrillic and the test wouldn't resemble a production token.
 */
function makeToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => {
    const utf8 = new TextEncoder().encode(JSON.stringify(obj));
    const binary = String.fromCharCode(...utf8);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  localStorage.clear();
});

describe('parseJwt', () => {
  it('decodes the payload', () => {
    const token = makeToken({ sub: 'user_1', role: 'BROKER', exp: nowSec() + 3600 });
    expect(parseJwt(token)).toMatchObject({ sub: 'user_1', role: 'BROKER' });
  });

  it('decodes non-ASCII claims without mangling them', () => {
    const token = makeToken({ name: 'Иван Петров', exp: nowSec() + 3600 });
    expect(parseJwt(token)?.name).toBe('Иван Петров');
  });

  it('returns null instead of throwing on malformed input', () => {
    expect(parseJwt('not-a-token')).toBeNull();
    expect(parseJwt('a.b')).toBeNull();
    expect(parseJwt('a.!!!not-base64!!!.c')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('treats a missing token as expired', () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it('treats a token with no exp claim as expired', () => {
    expect(isTokenExpired(makeToken({ sub: 'user_1' }))).toBe(true);
  });

  it('accepts a token that is comfortably in the future', () => {
    expect(isTokenExpired(makeToken({ exp: nowSec() + 3600 }))).toBe(false);
  });

  it('rejects a token that already expired', () => {
    expect(isTokenExpired(makeToken({ exp: nowSec() - 1 }))).toBe(true);
  });

  it('rejects a token inside the 30-second safety buffer', () => {
    // Still technically valid, but would expire mid-request.
    expect(isTokenExpired(makeToken({ exp: nowSec() + 10 }))).toBe(true);
  });
});

describe('getToken', () => {
  it('reads the token from localStorage', () => {
    localStorage.setItem('token', 'abc');
    expect(getToken()).toBe('abc');
  });

  it('returns null when nothing is stored', () => {
    expect(getToken()).toBeNull();
  });
});

describe('clearAuthAndRedirect', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('wipes the session and sends the user to the login screen', () => {
    Object.defineProperty(window, 'location', { value: { href: '/dashboard/crm' }, writable: true });
    localStorage.setItem('token', 'abc');
    localStorage.setItem('user', '{"id":"1"}');

    clearAuthAndRedirect();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
