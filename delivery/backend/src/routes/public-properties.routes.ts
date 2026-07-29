import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const publicPropertiesRouter = Router();

const CARD_SELECT = {
  id: true,
  district: true,
  residentialComplex: true,
  address: true,
  lat: true,
  lng: true,
  rooms: true,
  area: true,
  price: true,
  images: true,
};

const DETAIL_SELECT = {
  ...CARD_SELECT,
  floor: true,
  totalFloors: true,
  buildingType: true,
  repairState: true,
  balconyType: true,
};

function serializeCard(property: any) {
  return {
    ...property,
    area: Number(property.area),
    price: Number(property.price),
  };
}

// GET /api/public/properties?district=...
// Note: CrmProperty has no `city` column (only `district`) — this project's
// catalog is Almaty-only for now, so there is nothing to filter city by yet.
publicPropertiesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { district } = req.query;

    const where: any = {
      funnelStage: 'LEADS',
      publishedAt: { not: null },
      status: 'ACTIVE',
    };
    if (district) {
      where.district = district as string;
    }

    const properties = await prisma.crmProperty.findMany({
      where,
      select: CARD_SELECT,
      orderBy: { publishedAt: 'desc' },
    });

    res.json({ properties: properties.map(serializeCard) });
  } catch (error) {
    console.error('Public properties list error:', error);
    res.status(500).json({ error: 'Ошибка получения списка объектов' });
  }
});

// GET /api/public/properties/:id
publicPropertiesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const property = await prisma.crmProperty.findFirst({
      where: { id, funnelStage: 'LEADS', publishedAt: { not: null }, status: 'ACTIVE' },
      select: DETAIL_SELECT,
    });

    if (!property) {
      res.status(404).json({ error: 'Объявление не найдено' });
      return;
    }

    res.json(serializeCard(property));
  } catch (error) {
    console.error('Public property detail error:', error);
    res.status(500).json({ error: 'Ошибка получения объявления' });
  }
});
