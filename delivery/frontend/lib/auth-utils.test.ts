import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStoredUser, hasStoredSession, clearAuthAndRedirect } from './auth-utils';

beforeEach(() => {
  localStorage.clear();
  // fetch зовётся из clearAuthAndRedirect (logout) — глушим, чтобы тест не ходил в сеть.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })) as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getStoredUser', () => {
  it('reads the stored user profile', () => {
    localStorage.setItem('user', '{"id":"1","role":"ADMIN"}');
    expect(getStoredUser()).toMatchObject({ id: '1', role: 'ADMIN' });
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredUser()).toBeNull();
  });

  it('returns null instead of throwing on corrupt JSON', () => {
    localStorage.setItem('user', 'not-json');
    expect(getStoredUser()).toBeNull();
  });
});

describe('hasStoredSession', () => {
  it('is true when a user profile is present', () => {
    localStorage.setItem('user', '{"id":"1"}');
    expect(hasStoredSession()).toBe(true);
  });

  it('is false when nothing is stored', () => {
    expect(hasStoredSession()).toBe(false);
  });
});

describe('clearAuthAndRedirect', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('wipes the profile, calls logout and sends the user to the login screen', () => {
    Object.defineProperty(window, 'location', { value: { href: '/dashboard/crm' }, writable: true });
    localStorage.setItem('token', 'legacy');
    localStorage.setItem('user', '{"id":"1"}');

    clearAuthAndRedirect();

    // logout вызван, чтобы сервер погасил httpOnly-cookie
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout'), expect.objectContaining({ method: 'POST' }));
    // локальные данные стёрты, включая легаси-ключ token
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
