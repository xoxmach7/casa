import { prisma } from './prisma';

export interface AuditLogEntry {
  actorUserId?: string | null;
  actorRole?: string | null;
  actorType?: 'HUMAN' | 'AI';
  aiModel?: string;
  aiPromptVersion?: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  source?: string;
  oldValues?: unknown;
  newValues?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Append-only: CASA Developer Handoff v2.0 требует, чтобы критические
// изменения (статусы, цены, согласия, права) писались сюда без исключений.
// Секреты, полный ИИН и содержимое финансовых документов сюда не пишутся —
// вызывающий код обязан передавать в oldValues/newValues только безопасные поля.
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? null,
      actorType: entry.actorType ?? 'HUMAN',
      aiModel: entry.aiModel,
      aiPromptVersion: entry.aiPromptVersion,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      requestId: entry.requestId,
      source: entry.source ?? 'api',
      oldValues: entry.oldValues as any,
      newValues: entry.newValues as any,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}
