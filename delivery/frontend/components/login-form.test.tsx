import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

async function submitLogin(email = 'broker@casa.kz', password = 'broker123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Пароль'), password);
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('LoginForm', () => {
  it('lands the broker on Сделки (CRM), not on the summary screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'jwt-token', user: { id: 'u1', role: 'BROKER' } }),
      })
    );

    render(<LoginForm />);
    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/crm'));
  });

  it('stores the token and user so the next request is authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'jwt-token', user: { id: 'u1', role: 'BROKER' } }),
      })
    );

    render(<LoginForm />);
    await submitLogin();

    await waitFor(() => expect(localStorage.getItem('token')).toBe('jwt-token'));
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ id: 'u1', role: 'BROKER' });
  });

  it('shows the server error and stays put on bad credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Неверный email или пароль' }) })
    );

    render(<LoginForm />);
    await submitLogin('broker@casa.kz', 'wrong');

    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('reports an unreachable backend instead of failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<LoginForm />);
    await submitLogin();

    expect(await screen.findByText('Не удалось подключиться к серверу')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
