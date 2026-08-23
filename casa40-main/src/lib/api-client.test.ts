import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, logout } from './api-client';

describe('cookie-only api client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends credentials and never an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ role: 'ADMIN' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/auth/me');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('logs out through the backend cookie endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
