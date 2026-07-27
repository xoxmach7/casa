import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { z } from 'zod';

export const mortgageRouter = Router();
mortgageRouter.use(authenticate);

// Validation schema for mortgage calculation
const mortgageCalculationSchema = z.object({
  clientId: z.string(),
  apartmentId: z.string().optional(),
  propertyPrice: z.number().positive(),
  initialPayment: z.number().nonnegative(),
  loanAmount: z.number().positive(),
  interestRate: z.number().positive(),
  termMonths: z.number().int().positive(),
  monthlyPayment: z.number().positive(),
  totalPayment: z.number().positive(),
  overpayment: z.number().nonnegative(),
  bankName: z.string().optional(),
  programName: z.string().optional(),
  apartmentInfo: z.string().optional(),
});

// POST /api/mortgage/calculate - расчет ипотеки (сохранение)
mortgageRouter.post('/calculate', async (req, res): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    const validationResult = mortgageCalculationSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: 'Invalid data', details: validationResult.error.errors });
      return;
    }
    
    const data = validationResult.data;
    
    // Verify client belongs to this broker (for brokers)
    if (userRole === 'BROKER') {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, brokerId: userId }
      });
      
      if (!client) {
        return res.status(403).json({ error: 'Access denied to this client' }) as any;
      }
    }
    
    // Create mortgage calculation
    const calculation = await prisma.mortgageCalculation.create({
      data: {
        clientId: data.clientId,
        apartmentId: data.apartmentId || null,
        propertyPrice: data.propertyPrice,
        initialPayment: data.initialPayment,
        loanAmount: data.loanAmount,
        interestRate: data.interestRate,
        termMonths: data.termMonths,
        monthlyPayment: data.monthlyPayment,
        totalPayment: data.totalPayment,
        overpayment: data.overpayment,
        bankName: data.bankName,
        programName: data.programName,
        apartmentInfo: data.apartmentInfo,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        apartment: {
          select: {
            id: true,
            number: true,
            rooms: true,
            area: true,
            price: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    res.status(201).json(calculation);
  } catch (error) {
    console.error('Error saving mortgage calculation:', error);
    res.status(500).json({ error: 'Failed to save mortgage calculation' });
  }
});

// GET /api/mortgage/calculations/:clientId - get calculations for a client
mortgageRouter.get('/calculations/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    // Verify client belongs to this broker (for brokers)
    if (userRole === 'BROKER') {
      const client = await prisma.client.findFirst({
        where: { id: clientId, brokerId: userId }
      });
      
      if (!client) {
        return res.status(403).json({ error: 'Access denied to this client' }) as any;
      }
    }
    
    const calculations = await prisma.mortgageCalculation.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(calculations);
  } catch (error) {
    console.error('Error fetching mortgage calculations:', error);
    res.status(500).json({ error: 'Failed to fetch mortgage calculations' });
  }
});

