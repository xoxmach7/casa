// Единая политика доступа к CRM. Раньше авторизация строилась на «чёрном
// списке» ролей (`restrictedRoles = ['BROKER','REALTOR','AGENCY']`),
// разбросанном ~40 раз по роутам: список перечислял, кого ОГРАНИЧИТЬ, поэтому
// любая роль не из списка молча получала полный доступ. Так COORDINATOR и
// ANALYST, добавленные в enum, получили сквозной доступ ко всему CRM, включая
// право менять и удалять чужие записи (см. docs/SECURITY-AUDIT-2026-08-10.md,
// HIGH-1).
//
// Продуктовое решение: ANALYST и COORDINATOR видят весь CRM, но ТОЛЬКО читают.
// Писать в контуре вторички (Deal Room, оценка) им по-прежнему можно — те
// роутеры держат собственные allow-list'ы (WORK_ROLES/DECIDE_ROLES) и этим
// middleware НЕ оборачиваются.

import { Request, Response, NextFunction } from 'express';

// Роли, которым в основном CRM разрешено только чтение.
export const CRM_READ_ONLY_ROLES = ['ANALYST', 'COORDINATOR'] as const;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Отдаёт 403 на любой изменяющий запрос от read-only роли. Вешается на
// бизнес-роутеры ПОСЛЕ authenticate. Проверяет метод, а не конкретный путь,
// поэтому автоматически закрывает и будущие write-роуты — дыру больше нельзя
// открыть, забыв добавить роль в очередной список.
export function blockCrmWrites(req: Request, res: Response, next: NextFunction): void {
  if (MUTATING_METHODS.has(req.method) && CRM_READ_ONLY_ROLES.includes(req.user?.role as any)) {
    res.status(403).json({ error: 'Доступ только для чтения' });
    return;
  }
  next();
}
