import { Request, Response, NextFunction } from 'express';

// Защита от CSRF для cookie-авторизации.
//
// Раньше сессия жила в Authorization: Bearer, и CSRF был невозможен в принципе
// (сторонний сайт не может прочитать токен и подставить заголовок). Перейдя на
// httpOnly-cookie (см. docs/SECURITY-AUDIT-2026-08-10.md, MEDIUM-3), мы закрыли
// кражу токена через XSS — но cookie браузер шлёт на наш API автоматически,
// поэтому вернулся вектор CSRF: злонамеренная страница могла бы заставить
// браузер отправить изменяющий запрос с валидной cookie.
//
// Барьер — заголовок Origin. На любом кросс-сайтовом запросе браузер выставляет
// Origin сам, и из JS его подделать нельзя. Значит на изменяющих методах
// достаточно проверить: если Origin есть и он не из белого списка — это чужой
// сайт, режем. Origin отсутствует (curl, сервер-сервер, healthcheck) — пропуск:
// cookie кросс-сайтово туда всё равно не уйдёт, а Bearer-клиенты от CSRF
// неуязвимы. GET/HEAD не меняют состояние и не проверяются.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfGuard(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Cross-origin request blocked' });
      return;
    }
    next();
  };
}
