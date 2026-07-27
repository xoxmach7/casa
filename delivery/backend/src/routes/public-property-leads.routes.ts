import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { pickBroker } from '../lib/lead-assignment';

export const publicPropertyLeadsRouter = Router();

const propertyLeadSchema = z.object({
  district: z.string().min(1),
  residentialComplex: z.string().min(1),
  address: z.string().min(1),
  houseNumber: z.string().min(1),
  price: z.number().positive(),
  negotiable: z.boolean(),
  moveInReady: z.boolean(),
  furnished: z.boolean(),
  hasAppliances: z.boolean(),
  rooms: z.number().int().positive(),
  area: z.number().positive(),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
  photoUrls: z.array(z.string()).optional(),
});

publicPropertyLeadsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = propertyLeadSchema.parse(req.body);

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const { brokerId, isFallback } = pickBroker({
      distributionType: 'MANUAL',
      brokerPool: [],
      fallbackBrokerId: admin?.id,
    });

    if (!brokerId) {
      res.status(500).json({ error: 'No broker available to assign lead' });
      return;
    }

    const nameParts = data.contactName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const fullAddress = `${data.address}, д. ${data.houseNumber}`;

    // Seller and draft CrmProperty must be created together — a Seller with
    // no listing behind it is an orphaned record a broker can't act on.
    const { seller } = await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.create({
        data: {
          brokerId,
          firstName,
          lastName,
          phone: data.contactPhone,
          source: 'Форма: Добавить квартиру',
          funnelStage: 'CONTACT',
          readyToNegotiate: data.negotiable,
        },
      });

      const property = await tx.crmProperty.create({
        data: {
          district: data.district,
          residentialComplex: data.residentialComplex,
          address: fullAddress,
          rooms: data.rooms,
          area: data.area,
          floor: 0,
          totalFloors: 0,
          yearBuilt: new Date().getFullYear(),
          price: data.price,
          images: data.photoUrls ?? [],
          funnelStage: 'CREATED',
          sellerId: seller.id,
          brokerId,
          hasBuiltInAppliances: data.hasAppliances,
          furnitureLevel: data.furnished ? 'FULL' : 'NONE',
          notes: data.moveInReady ? 'Можно заселиться сразу (со слов владельца)' : undefined,
        },
      });

      return { seller, property };
    });

    await prisma.notification.create({
      data: {
        userId: brokerId,
        type: 'DEAL',
        title: 'Новая заявка на продажу',
        message: `${firstName} ${lastName} хочет продать квартиру: ${data.residentialComplex}, ${data.district}.${isFallback ? ' [Назначено автоматически]' : ''}`,
        isRead: false,
      },
    });

    res.json({ success: true, sellerId: seller.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Property lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
