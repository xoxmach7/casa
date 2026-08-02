import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const publicProjectsRouter = Router();

// New-build (новостройки) catalog — mirrors public-properties.routes.ts's
// pattern but sources from Project/Apartment (CRM's "ЖК" model) instead of
// CrmProperty. Only projects an admin has explicitly published are visible;
// isPublished defaults to false so existing CRM-managed projects stay
// internal until someone opts them in.

const CARD_SELECT = {
  id: true,
  name: true,
  city: true,
  district: true,
  address: true,
  lat: true,
  lng: true,
  class: true,
  buildingStatus: true,
  deliveryDate: true,
  developerName: true,
  images: true,
};

const DETAIL_SELECT = {
  ...CARD_SELECT,
  description: true,
  developerPhone: true,
  bonus: true,
  promotions: true,
  mortgagePrograms: true,
  videoUrl: true,
};

const APARTMENT_SELECT = {
  id: true,
  number: true,
  floor: true,
  rooms: true,
  area: true,
  price: true,
  status: true,
  layoutImage: true,
  images: true,
};

function serializeApartment(apartment: any) {
  return {
    ...apartment,
    area: Number(apartment.area),
    price: Number(apartment.price),
  };
}

function serializeProjectCard(project: any) {
  const prices = (project.apartments ?? [])
    .filter((a: any) => a.status === 'AVAILABLE')
    .map((a: any) => Number(a.price));

  return {
    ...project,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    availableApartments: prices.length,
    apartments: undefined,
  };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 100;

// GET /api/public/projects?city=...&district=...
publicProjectsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { city, district, page = '1', limit = String(DEFAULT_PAGE_SIZE) } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit as string) || DEFAULT_PAGE_SIZE));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { isPublished: true };
    if (city) where.city = city as string;
    if (district) where.district = district as string;

    const projects = await prisma.project.findMany({
      where,
      select: {
        ...CARD_SELECT,
        apartments: { select: { price: true, status: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limitNum,
      skip,
    });

    res.json({ projects: projects.map(serializeProjectCard) });
  } catch (error) {
    console.error('Public projects list error:', error);
    res.status(500).json({ error: 'Ошибка получения списка новостроек' });
  }
});

// GET /api/public/projects/:id
publicProjectsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: { id, isPublished: true },
      select: DETAIL_SELECT,
    });

    if (!project) {
      res.status(404).json({ error: 'Жилой комплекс не найден' });
      return;
    }

    const apartments = await prisma.apartment.findMany({
      where: { projectId: id, status: 'AVAILABLE' },
      select: APARTMENT_SELECT,
      orderBy: [{ rooms: 'asc' }, { floor: 'asc' }],
    });

    res.json({ ...project, apartments: apartments.map(serializeApartment) });
  } catch (error) {
    console.error('Public project detail error:', error);
    res.status(500).json({ error: 'Ошибка получения жилого комплекса' });
  }
});
