/**
 * Утилиты аутентификации.
 * Единственный модуль для работы с JWT на клиенте.
 */

interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  role?: string;
  [key: string]: unknown;
}

/** Декодирует payload JWT без верификации подписи (клиентская сторона). */
export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Проверяет, истёк ли JWT-токен. Возвращает true если токен невалиден или exp < now. */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;

  // Даём буфер в 30 секунд, чтобы не ловить race condition
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp < nowSec + 30;
}

/** Безопасно достаёт токен из localStorage. */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

/** Очищает данные авторизации и перенаправляет на логин. */
export function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
