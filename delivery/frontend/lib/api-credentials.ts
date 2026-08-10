// Заставляет ВСЕ запросы к нашему API отправлять cookie. Сессия теперь живёт
// в httpOnly-cookie (см. docs/SECURITY-AUDIT-2026-08-10.md, MEDIUM-3), а браузер
// шлёт кросс-сайтовую cookie только при credentials:'include'. Axios-инстанс
// закрыт своим withCredentials; здесь — единая точка для десятков «сырых»
// fetch(getApiUrl(...)), чтобы не проставлять credentials в каждом из них
// вручную (и не забыть в будущих).
//
// Патчим глобальный fetch, но добавляем credentials ТОЛЬКО для URL нашего API.
// Собственные same-origin запросы Next.js (навигация, RSC) идут на домен crm,
// под условие не попадают и остаются нетронутыми. Guard по window — модуль
// импортируется и на сервере (SSR client-компонента), там fetch не трогаем.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url ?? '';
}

if (typeof window !== 'undefined' && !(window as any).__apiCredsPatched) {
  (window as any).__apiCredsPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (urlOf(input).startsWith(API_BASE)) {
      init = { ...init, credentials: 'include' };
    }
    return original(input, init);
  };
}

// Пустой экспорт — модуль подключают ради сайд-эффекта выше.
export {};
