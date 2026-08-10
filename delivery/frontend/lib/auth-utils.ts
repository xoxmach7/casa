/**
 * Утилиты аутентификации на клиенте.
 *
 * Токен сессии больше НЕ хранится в JS: он живёт в httpOnly-cookie, недоступной
 * из скрипта (см. docs/SECURITY-AUDIT-2026-08-10.md, MEDIUM-3). Поэтому клиент
 * не читает и не проверяет токен — авторизацию несёт cookie, а истёкшую сессию
 * ловит перехватчик 401 в api-client. В localStorage остаётся только объект
 * `user` (имя, роль, email) — это не секрет, он нужен для UI и роут-гарда.
 */

export interface StoredUser {
  id?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

/** Читает сохранённый профиль пользователя (для UI и проверки роли). */
export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** Есть ли локальный признак сессии. Настоящая проверка — на сервере (cookie). */
export function hasStoredSession(): boolean {
  return getStoredUser() !== null;
}

/**
 * Завершает сессию: гасит httpOnly-cookie на сервере (её из JS не стереть),
 * чистит локальный профиль и уводит на логин. Работает и при недоступном
 * бэкенде — редирект произойдёт в любом случае.
 */
export function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;

  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  // fetch пропатчен на credentials:'include' (см. lib/api-credentials), так что
  // cookie уйдёт и сервер её очистит. Ответ не ждём — UX не должен зависеть от него.
  try {
    fetch(`${base}/api/auth/logout`, { method: 'POST' }).catch(() => {});
  } catch {
    /* ignore */
  }

  localStorage.removeItem('user');
  // Легаси-ключ на случай старых вкладок, где токен когда-то лежал в localStorage.
  localStorage.removeItem('token');
  window.location.href = '/login';
}
