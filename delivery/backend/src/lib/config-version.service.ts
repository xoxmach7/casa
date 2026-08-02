import { prisma } from './prisma';

// Возвращает значение версионируемого справочника, действующее на указанную
// дату (по умолчанию — сейчас): effective_from <= at И
// (effective_to IS NULL ИЛИ effective_to > at), is_active = true.
// Если подходящих версий несколько — берётся самая свежая по effective_from.
export async function getActiveConfigValue<T = unknown>(
  key: string,
  options: { scope?: string; at?: Date } = {}
): Promise<T | null> {
  const at = options.at ?? new Date();

  const version = await prisma.configVersion.findFirst({
    where: {
      key,
      scope: options.scope ?? null,
      isActive: true,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  return version ? (version.value as T) : null;
}
