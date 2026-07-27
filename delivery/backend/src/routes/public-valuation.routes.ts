import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { computeValuation } from '../lib/valuation.service';

export const publicValuationRouter = Router();

const valuationRequestSchema = z.object({
  district: z.string().min(1),
  rooms: z.number().int().positive(),
  area: z.number().positive(),
});

publicValuationRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { district, rooms, area } = valuationRequestSchema.parse(req.body);

    // Only draw comparables from the same set the public catalog already
    // exposes (published + actively marketed). Anything broader — draft
    // listings, showings, deals in progress, closed sale prices — is
    // internal CRM data; including it here would let an anonymous caller
    // recover a specific non-public record's price by enumerating
    // district/rooms buckets and differencing against the public catalog.
    const comparables = await prisma.crmProperty.findMany({
      where: {
        district,
        rooms,
        funnelStage: 'LEADS',
        publishedAt: { not: null },
      },
      select: { price: true, area: true },
    });

    const numericComparables = comparables.map((c) => ({
      price: Number(c.price),
      area: Number(c.area),
    }));

    const result = computeValuation(numericComparables, area);

    if (!result) {
      res.status(422).json({ error: 'Недостаточно данных по этому району' });
      return;
    }

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Public valuation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
