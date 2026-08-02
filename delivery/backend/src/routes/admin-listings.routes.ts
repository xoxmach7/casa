// =========================================
// ADMIN LISTINGS ROUTES (casa40-main integration, 2026-08-02)
// Backs the lightweight admin panel of casa.kz (объекты/лиды со своим
// простым статус-флоу new→published→showing→in_deal, оплата вознаграждения,
// чек-лист документов). Deliberately separate from crm-properties.routes.ts
// (broker CRM funnel) — same CrmProperty storage, different, simpler API
// surface and status model (PublicListingOps), per the casa40 gap-audit.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../lib/audit-log.service';

export const adminListingsRouter = Router();
adminListingsRouter.use(authenticate, requireRole('ADMIN'));

// Ensures a PublicListingOps row exists for a property — created lazily on
// first admin touch rather than at property-creation time.
async function ensureOps(propertyId: string) {
  return prisma.publicListingOps.upsert({
    where: { propertyId },
    update: {},
    create: { propertyId },
  });
}

// GET /api/admin/listings
adminListingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const properties = await prisma.crmProperty.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        publicListingOps: true,
        publicListingLeads: { orderBy: { createdAt: 'desc' } },
        seller: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    res.json({ properties });
  } catch (error) {
    console.error('Admin list listings error:', error);
    res.status(500).json({ error: 'Ошибка получения списка объектов' });
  }
});

// GET /api/admin/listings/:id
adminListingsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const property = await prisma.crmProperty.findUnique({
      where: { id: req.params.id },
      include: {
        publicListingOps: { include: { selectedLead: true } },
        publicListingLeads: { orderBy: { createdAt: 'desc' } },
        seller: true,
      },
    });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }
    res.json(property);
  } catch (error) {
    console.error('Admin get listing error:', error);
    res.status(500).json({ error: 'Ошибка получения объекта' });
  }
});

const createListingSchema = z.object({
  district: z.string().min(1),
  residentialComplex: z.string().min(1),
  address: z.string().optional(),
  rooms: z.number().int().positive(),
  area: z.number().positive(),
  price: z.number().positive(),
  floor: z.number().int().min(0).optional(),
  totalFloors: z.number().int().min(0).optional(),
  yearBuilt: z.number().int().optional(),
  sellerId: z.string().min(1),
});

// POST /api/admin/listings
adminListingsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createListingSchema.parse(req.body);

    const property = await prisma.crmProperty.create({
      data: {
        district: data.district,
        residentialComplex: data.residentialComplex,
        address: data.address,
        rooms: data.rooms,
        area: data.area,
        price: data.price,
        floor: data.floor ?? 0,
        totalFloors: data.totalFloors ?? 0,
        yearBuilt: data.yearBuilt ?? new Date().getFullYear(),
        sellerId: data.sellerId,
        brokerId: req.user!.userId,
        status: 'MODERATION',
        funnelStage: 'CREATED',
      },
    });
    await ensureOps(property.id);

    await recordAuditLog({
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'CREATE',
      entityType: 'PublicListing',
      entityId: property.id,
    });

    res.status(201).json(property);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Admin create listing error:', error);
    res.status(500).json({ error: 'Ошибка создания объекта' });
  }
});

const updateListingSchema = z.object({
  district: z.string().optional(),
  residentialComplex: z.string().optional(),
  address: z.string().optional(),
  rooms: z.number().int().positive().optional(),
  area: z.number().positive().optional(),
  price: z.number().positive().optional(),
  floor: z.number().int().min(0).optional(),
  totalFloors: z.number().int().min(0).optional(),
  yearBuilt: z.number().int().optional(),
  description: z.string().optional(),
  negotiable: z.boolean().optional(),
  readyToMoveIn: z.boolean().optional(),
  images: z.array(z.string()).optional(),
  layoutImage: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// PATCH /api/admin/listings/:id
adminListingsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = updateListingSchema.parse(req.body);

    const existing = await prisma.crmProperty.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const updated = await prisma.crmProperty.update({ where: { id: req.params.id }, data });

    await recordAuditLog({
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'UPDATE',
      entityType: 'PublicListing',
      entityId: updated.id,
      newValues: data,
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Admin update listing error:', error);
    res.status(500).json({ error: 'Ошибка обновления объекта' });
  }
});

const statusSchema = z.object({
  status: z.enum(['NEW', 'PUBLISHED', 'SHOWING', 'IN_DEAL', 'ARCHIVED']),
  selectedLeadId: z.string().optional(),
});

// POST /api/admin/listings/:id/status
adminListingsRouter.post('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = statusSchema.parse(req.body);
    const property = await prisma.crmProperty.findUnique({ where: { id: req.params.id } });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    await ensureOps(property.id);
    const ops = await prisma.publicListingOps.update({
      where: { propertyId: property.id },
      data: {
        status: body.status,
        ...(body.selectedLeadId ? { selectedLeadId: body.selectedLeadId } : {}),
      },
    });

    // Keep the public catalog's own status/funnelStage/publishedAt in sync
    // with the lightweight admin's simpler flow — public-properties.routes.ts
    // requires ALL THREE (status=ACTIVE, funnelStage=LEADS, publishedAt set)
    // before a listing is catalog-visible.
    await prisma.crmProperty.update({
      where: { id: property.id },
      data: {
        status: body.status === 'ARCHIVED' ? 'ARCHIVED' : body.status === 'PUBLISHED' ? 'ACTIVE' : property.status,
        funnelStage: body.status === 'PUBLISHED' ? 'LEADS' : property.funnelStage,
        publishedAt: body.status === 'PUBLISHED' && !property.publishedAt ? new Date() : property.publishedAt,
      },
    });

    await recordAuditLog({
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'TRANSITION',
      entityType: 'PublicListingOps',
      entityId: ops.id,
      newValues: { status: body.status },
    });

    res.json(ops);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Admin listing status error:', error);
    res.status(500).json({ error: 'Ошибка смены статуса' });
  }
});

const paymentSchema = z.object({
  paymentAmount: z.number().positive(),
  paymentReceiptFileId: z.string().optional(),
  paymentComment: z.string().optional(),
});

// POST /api/admin/listings/:id/payment
adminListingsRouter.post('/:id/payment', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = paymentSchema.parse(req.body);
    const property = await prisma.crmProperty.findUnique({ where: { id: req.params.id } });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    await ensureOps(property.id);
    const ops = await prisma.publicListingOps.update({
      where: { propertyId: property.id },
      data: {
        paymentStatus: 'PAID',
        paymentAmount: body.paymentAmount,
        paymentReceiptFileId: body.paymentReceiptFileId,
        paymentComment: body.paymentComment,
      },
    });

    await recordAuditLog({
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'CONFIRM_PAYMENT',
      entityType: 'PublicListingOps',
      entityId: ops.id,
      newValues: { paymentAmount: body.paymentAmount },
    });

    res.json(ops);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Admin listing payment error:', error);
    res.status(500).json({ error: 'Ошибка подтверждения оплаты' });
  }
});

// PATCH /api/admin/listings/:id/checklist
adminListingsRouter.patch('/:id/checklist', async (req: Request, res: Response): Promise<void> => {
  try {
    const property = await prisma.crmProperty.findUnique({ where: { id: req.params.id } });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    await ensureOps(property.id);
    const ops = await prisma.publicListingOps.update({
      where: { propertyId: property.id },
      data: { verificationChecklist: req.body },
    });

    res.json(ops);
  } catch (error) {
    console.error('Admin listing checklist error:', error);
    res.status(500).json({ error: 'Ошибка обновления чек-листа' });
  }
});

// ------------------------------------------
// LEADS
// ------------------------------------------

// GET /api/admin/listings/leads/all
adminListingsRouter.get('/leads/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = await prisma.publicListingLead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { id: true, residentialComplex: true, district: true } } },
    });
    res.json({ leads });
  } catch (error) {
    console.error('Admin list leads error:', error);
    res.status(500).json({ error: 'Ошибка получения списка заявок' });
  }
});

const createLeadSchema = z.object({
  propertyId: z.string().min(1),
  buyerName: z.string().min(1),
  buyerPhone: z.string().min(1),
  comment: z.string().optional(),
});

// POST /api/admin/listings/leads
adminListingsRouter.post('/leads', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createLeadSchema.parse(req.body);
    const property = await prisma.crmProperty.findUnique({ where: { id: data.propertyId } });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const lead = await prisma.publicListingLead.create({ data });
    res.status(201).json(lead);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Admin create lead error:', error);
    res.status(500).json({ error: 'Ошибка создания заявки' });
  }
});

const updateLeadSchema = z.object({
  buyerName: z.string().optional(),
  buyerPhone: z.string().optional(),
  status: z.string().optional(),
  comment: z.string().nullable().optional(),
  // Switching financing method clears the previous bank/pre-approval/amount
  // on the client — these must accept an explicit null, not just be absent.
  financingType: z.string().nullable().optional(),
  financingBank: z.string().nullable().optional(),
  preApproved: z.boolean().nullable().optional(),
  mortgageAmount: z.number().positive().nullable().optional(),
  expectedTimeline: z.string().nullable().optional(),
  viewingDatetime: z.coerce.date().nullable().optional(),
});

// PATCH /api/admin/listings/leads/:id
adminListingsRouter.patch('/leads/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = updateLeadSchema.parse(req.body);
    const existing = await prisma.publicListingLead.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }

    const lead = await prisma.publicListingLead.update({ where: { id: req.params.id }, data });
    res.json(lead);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Admin update lead error:', error);
    res.status(500).json({ error: 'Ошибка обновления заявки' });
  }
});
