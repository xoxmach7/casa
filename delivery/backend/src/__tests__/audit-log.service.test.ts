import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../lib/audit-log.service';

describe('recordAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults actorType to HUMAN and source to api', async () => {
    await recordAuditLog({
      actorUserId: 'user_1',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entityType: 'Deal',
      entityId: 'deal_1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'HUMAN',
        source: 'api',
        actorUserId: 'user_1',
        actorRole: 'ADMIN',
        action: 'UPDATE',
        entityType: 'Deal',
        entityId: 'deal_1',
      }),
    });
  });

  it('records AI actor with model and prompt version', async () => {
    await recordAuditLog({
      actorType: 'AI',
      aiModel: 'claude-sonnet-5',
      aiPromptVersion: 'deal-watcher-v1',
      action: 'STAGE_SUGGESTED',
      entityType: 'Deal',
      entityId: 'deal_2',
      source: 'ai',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'AI',
        aiModel: 'claude-sonnet-5',
        aiPromptVersion: 'deal-watcher-v1',
        source: 'ai',
      }),
    });
  });

  it('passes through old/new values and reason for a manual override', async () => {
    await recordAuditLog({
      actorUserId: 'user_1',
      action: 'OVERRIDE',
      entityType: 'DealBooking',
      entityId: 'booking_1',
      oldValues: { status: 'pending_confirmation' },
      newValues: { status: 'active' },
      reason: 'coordinator manually verified transfer over the phone',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldValues: { status: 'pending_confirmation' },
        newValues: { status: 'active' },
        reason: 'coordinator manually verified transfer over the phone',
      }),
    });
  });
});
