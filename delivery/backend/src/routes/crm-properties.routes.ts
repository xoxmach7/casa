// =========================================
// CRM PROPERTIES ROUTES (CASA CRM)
// RESTful API with Calculator Service Integration
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';
import {
    CrmPropertyMinimalSchema,
    CrmPropertyFullSchema,
    CrmPropertyUpdateSchema,
} from '../lib/validation.schemas';
import {
    calculatePropertyClass,
    calculateLiquidityScore,
    calculateStrategy,
    getStrategyExplanation,
    calculateHybridStrategy,
    type PropertyClassInput,
    type LiquidityInput,
    type StrategyInput,
} from '../lib/property-calculator.service';

export const crmPropertiesRouter = Router();

// Apply auth middleware to all routes
crmPropertiesRouter.use(authenticate);

// =========================================
// HELPER: Run full property calculation
// =========================================
async function runPropertyCalculation(
    propertyId: string,
    propertyData: any,
    sellerData: any,
    previousData?: {
        calculatedClass: string | null;
        liquidityScore: number;
        activeStrategy: string | null;
    }
) {
    // 1. Calculate Property Class
    const classInput: PropertyClassInput = {
        yearBuilt: propertyData.yearBuilt,
        buildingType: propertyData.buildingType,
        ceilingHeight: Number(propertyData.ceilingHeight) || 2.7,
        totalFloors: propertyData.totalFloors,
        apartmentsPerFloor: propertyData.apartmentsPerFloor || 6,
        parkingType: propertyData.parkingType,
        hasClosedTerritory: propertyData.hasClosedTerritory || false,
        elevatorCount: propertyData.elevatorCount || 0,
        hasFreightElevator: propertyData.hasFreightElevator || false,
        locationQuality: propertyData.locationQuality,
        glazingType: propertyData.glazingType,
        accessSystem: propertyData.accessSystem,
        facadeMaterial: propertyData.facadeMaterial,
        lobbyType: propertyData.lobbyType,
    };

    const calculatedClass = calculatePropertyClass(classInput);

    // 2. Determine Finance Type
    let financeType: 'MORTGAGE_AVAILABLE' | 'MORTGAGE_LIMITED' | 'CASH_ONLY' = 'MORTGAGE_AVAILABLE';
    if (calculatedClass === 'OLD_FUND') {
        financeType = propertyData.yearBuilt < 1970 ? 'CASH_ONLY' : 'MORTGAGE_LIMITED';
    } else if (propertyData.elevatorCount === 0 && propertyData.totalFloors > 5) {
        financeType = 'MORTGAGE_LIMITED';
    }

    // 3. Calculate Liquidity Score
    const liquidityInput: LiquidityInput = {
        calculatedClass,
        yearBuilt: propertyData.yearBuilt,
        floor: propertyData.floor,
        totalFloors: propertyData.totalFloors,
        rooms: propertyData.rooms,
        area: Number(propertyData.area),
        price: Number(propertyData.price),
        marketPrice: propertyData.marketPrice ? Number(propertyData.marketPrice) : null,
        repairState: propertyData.repairState || 'COSMETIC',
        actualCondition: propertyData.actualCondition || 'GOOD',
        parkingType: propertyData.parkingType,
        viewType: propertyData.viewType,
        mopState: propertyData.mopState,
        layoutType: propertyData.layoutType || 'ISOLATED',
        isCorner: false, // TODO: add field
        hasBalcony: propertyData.balconyType !== 'NONE',
        financeType,
        locationQuality: propertyData.locationQuality,
        elevatorCount: propertyData.elevatorCount || 0,
    };

    const liquidityResult = calculateLiquidityScore(liquidityInput);

    // 4. Calculate Strategy
    const hasLegalIssues =
        propertyData.encumbranceType !== 'NONE' ||
        propertyData.isMortgaged;

    const strategyInput: StrategyInput = {
        seller: {
            reason: sellerData?.reason || null,
            deadline: sellerData?.deadline || null,
            expectedPrice: sellerData?.expectedPrice ? Number(sellerData.expectedPrice) : null,
            minPrice: sellerData?.minPrice ? Number(sellerData.minPrice) : null,
            hasDebts: sellerData?.hasDebts || false,
            readyForExclusive: sellerData?.readyForExclusive || false,
            trustLevel: sellerData?.trustLevel || 3,
            readyToFollowRecommendations: sellerData?.readyToFollowRecommendations || null,
            plansToPurchase: sellerData?.plansToPurchase || false, // NEW: для стратегии S3
        },
        property: {
            calculatedClass,
            liquidityLevel: liquidityResult.level,
            liquidityScore: liquidityResult.score,
            price: Number(propertyData.price),
            marketPrice: propertyData.marketPrice ? Number(propertyData.marketPrice) : null,
            financeType,
            hasLegalIssues,
            legalIssueType: propertyData.encumbranceType,
        },
    };

    const activeStrategy = calculateStrategy(strategyInput);
    const strategyExplanation = getStrategyExplanation(activeStrategy);

    // 5. Check if we need to log the calculation (strategy changed)
    let shouldLog = !previousData;
    if (previousData) {
        shouldLog =
            previousData.calculatedClass !== calculatedClass ||
            previousData.activeStrategy !== activeStrategy ||
            Math.abs(previousData.liquidityScore - liquidityResult.score) > 5;
    }

    if (shouldLog) {
        await prisma.propertyCalculationLog.create({
            data: {
                propertyId,
                previousClass: previousData?.calculatedClass as any || null,
                newClass: calculatedClass,
                previousLiquidity: previousData?.liquidityScore || null,
                newLiquidity: liquidityResult.score,
                previousStrategy: previousData?.activeStrategy as any || null,
                newStrategy: activeStrategy,
                calculationReason: previousData ? 'PROPERTY_UPDATE' : 'PROPERTY_CREATION',
                inputData: {
                    class: classInput,
                    liquidity: liquidityInput,
                    strategy: strategyInput,
                } as any,
                outputData: {
                    calculatedClass,
                    financeType,
                    liquidityScore: liquidityResult.score,
                    liquidityLevel: liquidityResult.level,
                    isIlliquid: liquidityResult.isIlliquid,
                    illiquidReason: liquidityResult.hardTrigger || null,
                    activeStrategy,
                    strategyExplanation,
                },
            },
        });
    }

    return {
        calculatedClass,
        financeType,
        liquidityScore: liquidityResult.score,
        liquidityLevel: liquidityResult.level,
        isIlliquid: liquidityResult.isIlliquid,
        illiquidReason: liquidityResult.hardTrigger || null,
        activeStrategy,
        recommendedStrategy: activeStrategy,
        strategyExplanation,
        pricePerSqm: Number(propertyData.price) / Number(propertyData.area),
    };
}

// =========================================
// GET /api/crm-properties - Список объектов
// =========================================
crmPropertiesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            funnelStage,
            calculatedClass,
            liquidityLevel,
            activeStrategy,
            district,
            sellerId,
            brokerId,
            search,
            status,
            page = '1',
            limit = '20',
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        // Role-based filtering
        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
        if (restrictedRoles.includes(req.user?.role || '')) {
            where.brokerId = req.user!.userId;
        } else if (brokerId) {
            // Admin can filter by broker
            where.brokerId = brokerId as string;
        }

        if (funnelStage) where.funnelStage = funnelStage;
        if (calculatedClass) where.calculatedClass = calculatedClass;
        if (liquidityLevel) where.liquidityLevel = liquidityLevel;
        if (activeStrategy) where.activeStrategy = activeStrategy;
        if (district) where.district = district;
        if (sellerId) where.sellerId = sellerId;

        // Фильтр по статусу (по умолчанию исключаем архивные)
        if (status) {
            where.status = status;
        } else {
            where.status = { not: 'ARCHIVED' };
        }

        if (search) {
            where.OR = [
                { residentialComplex: { contains: search as string, mode: 'insensitive' } },
                { address: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const [properties, total] = await Promise.all([
            prisma.crmProperty.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { updatedAt: 'desc' },
                include: {
                    seller: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                            funnelStage: true,
                        },
                    },
                    broker: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    customStage: { select: { id: true, name: true, color: true } },
                    customFieldValues: { include: { field: true } }, // NEW
                },
            }),
            prisma.crmProperty.count({ where }),
        ]);

        res.json({
            properties,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error('Get CRM properties error:', error);
        res.status(500).json({ error: 'Ошибка получения списка объектов' });
    }
});

// =========================================
// GET /api/crm-properties/funnel-stats - Статистика по воронке объектов
// =========================================
crmPropertiesRouter.get('/funnel-stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const where: any = {};

        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
        if (restrictedRoles.includes(req.user?.role || '')) {
            where.brokerId = req.user!.userId;
        }

        const stats = await prisma.crmProperty.groupBy({
            by: ['funnelStage'],
            where,
            _count: { id: true },
        });

        const result = {
            CREATED: 0,
            PREPARATION: 0,
            LEADS: 0,
            SHOWS: 0,
            DEAL: 0,
            POST_SERVICE: 0,
        };

        stats.forEach((s) => {
            result[s.funnelStage as keyof typeof result] = s._count.id;
        });

        res.json(result);
    } catch (error) {
        console.error('Get property funnel stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики воронки' });
    }
});

// =========================================
// GET /api/crm-properties/analytics - Аналитика по классам и стратегиям
// =========================================
crmPropertiesRouter.get('/analytics', async (req: Request, res: Response): Promise<void> => {
    try {
        const where: any = {};

        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
        if (restrictedRoles.includes(req.user?.role || '')) {
            where.brokerId = req.user!.userId;
        }

        const [byClass, byLiquidity, byStrategy] = await Promise.all([
            prisma.crmProperty.groupBy({
                by: ['calculatedClass'],
                where,
                _count: { id: true },
            }),
            prisma.crmProperty.groupBy({
                by: ['liquidityLevel'],
                where,
                _count: { id: true },
            }),
            prisma.crmProperty.groupBy({
                by: ['activeStrategy'],
                where,
                _count: { id: true },
            }),
        ]);

        res.json({
            byClass: byClass.reduce((acc, item) => {
                if (item.calculatedClass) acc[item.calculatedClass] = item._count.id;
                return acc;
            }, {} as Record<string, number>),
            byLiquidity: byLiquidity.reduce((acc, item) => {
                if (item.liquidityLevel) acc[item.liquidityLevel] = item._count.id;
                return acc;
            }, {} as Record<string, number>),
            byStrategy: byStrategy.reduce((acc, item) => {
                if (item.activeStrategy) acc[item.activeStrategy] = item._count.id;
                return acc;
            }, {} as Record<string, number>),
        });
    } catch (error) {
        console.error('Get property analytics error:', error);
        res.status(500).json({ error: 'Ошибка получения аналитики' });
    }
});

// =========================================
// GET /api/crm-properties/archived - Получение архивных объектов
// =========================================
crmPropertiesRouter.get(
    '/archived',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const role = req.user!.role;

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            const where: any = {
                status: 'ARCHIVED',
                ...(restrictedRoles.includes(role || '') ? { brokerId: userId } : {})
            };

            const properties = await prisma.crmProperty.findMany({
                where,
                include: {
                    broker: { select: { id: true, firstName: true, lastName: true } },
                    seller: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { updatedAt: 'desc' }
            });

            res.json(properties);
        } catch (error) {
            console.error('Get archived properties error:', error);
            res.status(500).json({ error: 'Ошибка получения архива' });
        }
    }
);

// =========================================
// GET /api/crm-properties/:id - Детали объекта
// =========================================
crmPropertiesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const property = await prisma.crmProperty.findUnique({
            where: { id },
            include: {
                seller: true,
                broker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                    },
                },
                calculationLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                customFieldValues: { include: { field: true } }, // NEW
            },
        });

        if (!property) {
            res.status(404).json({ error: 'Объект не найден' });
            return;
        }

        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
        if (restrictedRoles.includes(req.user?.role || '') && property.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        res.json(property);
    } catch (error) {
        console.error('Get CRM property error:', error);
        res.status(500).json({ error: 'Ошибка получения объекта' });
    }
});

// =========================================
// GET /api/crm-properties/:id/strategy-details - Детали стратегии
// =========================================
crmPropertiesRouter.get('/:id/strategy-details', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const property = await prisma.crmProperty.findUnique({
            where: { id },
            include: {
                seller: true,
                calculationLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!property) {
            res.status(404).json({ error: 'Объект не найден' });
            return;
        }

        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
        if (restrictedRoles.includes(req.user?.role || '') && property.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // RESTRICT: REALTOR and AGENCY cannot see strategy details
        if (req.user?.role === 'REALTOR' || req.user?.role === 'AGENCY') {
            res.status(403).json({ error: 'Доступ к стратегиям запрещен' });
            return;
        }

        // Build detailed strategy explanation
        const strategyDetails = {
            // Current calculated values
            current: {
                propertyClass: property.calculatedClass,
                financeType: property.financeType,
                liquidityScore: property.liquidityScore,
                liquidityLevel: property.liquidityLevel,
                isIlliquid: property.isIlliquid,
                illiquidReason: property.illiquidReason,
                activeStrategy: property.activeStrategy,
                strategyExplanation: property.strategyExplanation,
            },

            // Key factors that determined the strategy
            factors: {
                class: {
                    yearBuilt: property.yearBuilt,
                    buildingType: property.buildingType,
                    ceilingHeight: property.ceilingHeight,
                    totalFloors: property.totalFloors,
                    apartmentsPerFloor: property.apartmentsPerFloor,
                    parkingType: property.parkingType,
                    hasClosedTerritory: property.hasClosedTerritory,
                    locationQuality: property.locationQuality,
                },
                liquidity: {
                    floor: property.floor,
                    area: property.area,
                    actualCondition: property.actualCondition,
                    repairState: property.repairState,
                    viewType: property.viewType,
                    mopState: property.mopState,
                },
                strategy: {
                    sellerTrustLevel: property.seller?.trustLevel,
                    sellerReadyForExclusive: property.seller?.readyForExclusive,
                    sellerDeadline: property.seller?.deadline,
                    encumbranceType: property.encumbranceType,
                    isMortgaged: property.isMortgaged,
                    priceVsMarket: property.marketPrice
                        ? (Number(property.price) / Number(property.marketPrice) - 1) * 100
                        : null,
                },
            },

            // Calculation history
            history: property.calculationLogs.map((log) => ({
                date: log.createdAt,
                reason: log.calculationReason,
                changes: {
                    class: log.previousClass !== log.newClass
                        ? { from: log.previousClass, to: log.newClass }
                        : null,
                    liquidity: log.previousLiquidity !== log.newLiquidity
                        ? { from: log.previousLiquidity, to: log.newLiquidity }
                        : null,
                    strategy: log.previousStrategy !== log.newStrategy
                        ? { from: log.previousStrategy, to: log.newStrategy }
                        : null,
                },
            })),
        };

        res.json(strategyDetails);
    } catch (error) {
        console.error('Get strategy details error:', error);
        res.status(500).json({ error: 'Ошибка получения деталей стратегии' });
    }
});

// =========================================
// POST /api/crm-properties/:id/generate-description - Генерация описания (AI)
// =========================================
crmPropertiesRouter.post(
    '/:id/generate-description',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const property = await prisma.crmProperty.findUnique({ where: { id } });

            if (!property) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            // Import dynamically if needed or assume it's available. 
            // In this file context, I need to make sure deepSeekService is imported.
            // Since I cannot easily add top-level import in replace_file_content without disturbing lines, 
            // I will assume I can import it or I will add the import in a separate call if needed.
            // But wait, replace_file is chunk based. I can just use the service if imported.
            // I'll check imports later. For now, I'll use the service variable.

            // Wait, I need to make sure `deepSeekService` is imported. 
            // I'll assume it is NOT imported yet.
            // So I will just add the route logic and THEN add the import at the top.

            const context = {
                residentialComplex: property.residentialComplex,
                district: property.district,
                area: property.area,
                floor: property.floor,
                totalFloors: property.totalFloors,
                repairState: property.repairState,
                strategy: property.activeStrategy || 'SALE',
            };

            const description = await import('../services/deepseek.service').then(m => m.deepSeekService.generateMarketingDescription(context));

            res.json({ description });
        } catch (error) {
            console.error('Generate description error:', error);
            res.status(500).json({ error: 'Ошибка генерации описания' });
        }
    }
);

// =========================================
// POST /api/crm-properties - Создание объекта
// =========================================
crmPropertiesRouter.post(
    '/',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    validate(CrmPropertyMinimalSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const data = req.body;

            // Verify seller exists and belongs to broker
            const seller = await prisma.seller.findUnique({
                where: { id: data.sellerId },
            });

            if (!seller) {
                res.status(404).json({ error: 'Продавец не найден' });
                return;
            }

            if (req.user?.role === 'BROKER' && seller.brokerId !== req.user.userId) {
                res.status(403).json({ error: 'Продавец принадлежит другому брокеру' });
                return;
            }

            // Create property first
            const property = await prisma.crmProperty.create({
                data: {
                    ...data,
                    brokerId: req.user!.userId,
                    funnelStage: 'CREATED',
                },
            });

            // Run calculation
            const calculationResult = await runPropertyCalculation(
                property.id,
                property,
                seller
            );

            // OVERRIDE: Do not assign strategy on creation (Wait for Strategy Stage)
            (calculationResult as any).activeStrategy = null;
            (calculationResult as any).strategyExplanation = null;

            // Update with calculated values
            const updatedProperty = await prisma.crmProperty.update({
                where: { id: property.id },
                data: calculationResult,
                include: {
                    seller: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    broker: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    calculationLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            });

            res.status(201).json(updatedProperty);
        } catch (error) {
            console.error('Create CRM property error:', error);
            res.status(500).json({ error: 'Ошибка создания объекта' });
        }
    }
);

// =========================================
// PUT /api/crm-properties/:id - Обновление объекта (с пересчётом)
// =========================================
crmPropertiesRouter.put(
    '/:id',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    validate(CrmPropertyUpdateSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { customFields, ...data } = req.body;

            const existing = await prisma.crmProperty.findUnique({
                where: { id },
                include: { seller: true },
            });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            // Update custom fields
            if (customFields && Object.keys(customFields).length > 0) {
                const promises = Object.entries(customFields).map(([fieldId, value]) => {
                    return prisma.customFieldValue.upsert({
                        where: {
                            fieldId_propertyId: {
                                fieldId,
                                propertyId: id,
                            },
                        },
                        create: {
                            fieldId,
                            propertyId: id,
                            value: String(value),
                        },
                        update: {
                            value: String(value),
                        },
                    });
                });
                await Promise.all(promises);
            }

            // Update basic data
            const updatedProperty = await prisma.crmProperty.update({
                where: { id },
                data,
            });

            // Recalculate if relevant fields changed
            const fieldsAffectingCalculation = [
                'yearBuilt', 'buildingType', 'ceilingHeight', 'totalFloors',
                'apartmentsPerFloor', 'parkingType', 'hasClosedTerritory',
                'elevatorCount', 'hasFreightElevator', 'locationQuality',
                'floor', 'area', 'price', 'marketPrice', 'repairState',
                'actualCondition', 'encumbranceType', 'isMortgaged',
                'layoutType', 'viewType', 'mopState',
            ];

            const needsRecalculation = fieldsAffectingCalculation.some(
                (field) => data[field] !== undefined
            );

            if (needsRecalculation) {
                const previousData = {
                    calculatedClass: existing.calculatedClass,
                    liquidityScore: existing.liquidityScore,
                    activeStrategy: existing.activeStrategy,
                };

                const calculationResult = await runPropertyCalculation(
                    id,
                    { ...existing, ...data },
                    existing.seller,
                    previousData
                );

                // If broker manually set strategy, don't overwrite activeStrategy
                if (existing.isStrategyManual) {
                    delete (calculationResult as any).activeStrategy;
                    delete (calculationResult as any).strategyExplanation;
                }

                const finalProperty = await prisma.crmProperty.update({
                    where: { id },
                    data: calculationResult,
                    include: {
                        seller: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                            },
                        },
                        broker: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                        calculationLogs: {
                            orderBy: { createdAt: 'desc' },
                            take: 3,
                        },
                    },
                });

                res.json(finalProperty);
                return;
            }

            // Return without recalculation
            const result = await prisma.crmProperty.findUnique({
                where: { id },
                include: {
                    seller: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    broker: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            res.json(result);
        } catch (error) {
            console.error('Update CRM property error:', error);
            res.status(500).json({ error: 'Ошибка обновления объекта' });
        }
    }
);

// =========================================
// PUT /api/crm-properties/:id/stage - Изменение этапа воронки
// =========================================
const updatePropertyStageSchema = z.object({
    funnelStage: z.enum(['CREATED', 'PREPARATION', 'LEADS', 'SHOWS', 'DEAL', 'SOLD', 'POST_SERVICE', 'ARCHIVED', 'CANCELLED']).optional(),
    customStageId: z.string().optional(),
    cancellationReason: z.enum(['CLIENT_REFUSED', 'WE_REFUSED']).optional(),
    cancellationComment: z.string().optional(),
}).refine(data => data.funnelStage || data.customStageId, {
    message: "Either funnelStage or customStageId must be provided"
});

crmPropertiesRouter.put(
    '/:id/stage',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    validate(updatePropertyStageSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { funnelStage, customStageId, cancellationReason, cancellationComment } = req.body;

            const existing = await prisma.crmProperty.findUnique({ where: { id } });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            // Prepare update data
            const updateData: any = {};

            if (funnelStage) {
                updateData.funnelStage = funnelStage;
                updateData.customStageId = null;

                // Classic validation logic (only for standard stages)
                if (!customStageId) { // Only validate if not setting a custom stage
                    const stages = ['CREATED', 'PREPARATION', 'LEADS', 'SHOWS', 'DEAL', 'SOLD', 'POST_SERVICE', 'ARCHIVED', 'CANCELLED'];
                    const currentIndex = stages.indexOf(existing.funnelStage);
                    const newIndex = stages.indexOf(funnelStage);

                    const isSpecialStage = funnelStage === 'SOLD' || funnelStage === 'ARCHIVED' || funnelStage === 'CANCELLED';
                    if (existing.customStageId === null && !isSpecialStage && Math.abs(newIndex - currentIndex) > 1) {
                        res.status(400).json({
                            error: 'Нельзя перескакивать этапы воронки',
                            currentStage: existing.funnelStage,
                            requestedStage: funnelStage,
                        });
                        return;
                    }
                }
            } else if (customStageId) {
                updateData.customStageId = customStageId;
                // If only customStageId is provided, we might want to set funnelStage to a generic 'CUSTOM' or leave it as is.
                // For now, we'll leave funnelStage unchanged if not explicitly provided.
            }

            // Cancellation logic
            if (funnelStage === 'CANCELLED') {
                if (cancellationReason) updateData.cancellationReason = cancellationReason;
                if (cancellationComment) updateData.cancellationComment = cancellationComment;
            } else {
                // Clear cancellation fields if not cancelling
                updateData.cancellationReason = null;
                updateData.cancellationComment = null;
            }

            const property = await prisma.crmProperty.update({
                where: { id },
                data: updateData,
            });

            res.json(property);
        } catch (error) {
            console.error('Update CRM property stage error:', error);
            res.status(500).json({ error: 'Ошибка изменения этапа' });
        }
    }
);

// =========================================
// PATCH /api/crm-properties/:id - Частичное обновление (для сохранения стратегии)
// =========================================
crmPropertiesRouter.patch(
    '/:id',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const data = req.body;

            const existing = await prisma.crmProperty.findUnique({
                where: { id },
                include: { seller: true }
            });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            // Simple update for specific fields allowed in patch
            // For now allow updating activeStrategy and logs
            const property = await prisma.crmProperty.update({
                where: { id },
                data: {
                    activeStrategy: data.activeStrategy,
                    strategyExplanation: data.strategyExplanation,
                }
            });

            res.json(property);
        } catch (error) {
            console.error('Patch CRM property error:', error);
            res.status(500).json({ error: 'Ошибка обновления' });
        }
    }
);

// =========================================
// POST /api/crm-properties/:id/recalculate - Принудительный пересчёт
// =========================================
crmPropertiesRouter.post(
    '/:id/recalculate',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const existing = await prisma.crmProperty.findUnique({
                where: { id },
                include: { seller: true },
            });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            const previousData = {
                calculatedClass: existing.calculatedClass,
                liquidityScore: existing.liquidityScore,
                activeStrategy: existing.activeStrategy,
            };

            const calculationResult = await runPropertyCalculation(
                id,
                existing,
                existing.seller,
                previousData
            );

            const property = await prisma.crmProperty.update({
                where: { id },
                data: calculationResult,
                include: {
                    seller: true,
                    calculationLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    },
                },
            });

            res.json({
                property,
                recalculated: true,
                changes: {
                    classChanged: previousData.calculatedClass !== property.calculatedClass,
                    liquidityChanged: previousData.liquidityScore !== property.liquidityScore,
                    strategyChanged: previousData.activeStrategy !== property.activeStrategy,
                },
            });
        } catch (error) {
            console.error('Recalculate property error:', error);
            res.status(500).json({ error: 'Ошибка пересчёта' });
        }
    }
);

import { deepSeekService } from '../services/deepseek.service';

// =========================================
// POST /api/crm-properties/:id/generate-strategy - AI Генерация обоснования
// =========================================
crmPropertiesRouter.post(
    '/:id/generate-strategy',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const property = await prisma.crmProperty.findUnique({
                where: { id },
                include: { seller: true },
            });

            if (!property) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(req.user?.role || '') && property.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            const context = {
                address: property.address || '',
                residentialComplex: property.residentialComplex,
                price: Number(property.price),
                area: Number(property.area),
                floor: property.floor,
                totalFloors: property.totalFloors,
                yearBuilt: property.yearBuilt,
                repairState: property.repairState,
                calculatedClass: property.calculatedClass || 'Не определен',
                liquidityScore: property.liquidityScore || 0,
                activeStrategy: property.activeStrategy || 'Не определена',
            };

            const justification = await deepSeekService.generateStrategyJustification(context);

            const updated = await prisma.crmProperty.update({
                where: { id },
                data: {
                    strategyExplanation: JSON.stringify(justification),
                },
            });

            res.json({ justification });
        } catch (error) {
            console.error('AI Generation error:', error);
            res.status(500).json({ error: 'Ошибка генерации AI' });
        }
    }
);

// =========================================
// POST /api/crm-properties/:id/generate-description - AI Генерация рекламного описания
// =========================================
crmPropertiesRouter.post(
    '/:id/generate-description',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const property = await prisma.crmProperty.findUnique({
                where: { id },
                include: { seller: true },
            });

            if (!property) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const context = {
                residentialComplex: property.residentialComplex,
                district: property.district,
                area: Number(property.area),
                floor: property.floor,
                totalFloors: property.totalFloors,
                repairState: property.repairState,
                strategy: property.activeStrategy || 'Не определена',
            };

            const description = await deepSeekService.generateMarketingDescription(context);

            await prisma.crmProperty.update({
                where: { id },
                data: { notes: description }, // Пока сохраняем в notes, если нет спец. поля description
                // TODO: Добавить поле description в схему призмы если notes занято
            });

            res.json({ description });
        } catch (error) {
            console.error('AI Marketing Generation error:', error);
            res.status(500).json({ error: 'Ошибка генерации описания' });
        }
    }
);

// =========================================
// DELETE /api/crm-properties/:id - Удаление объекта
// =========================================
crmPropertiesRouter.delete(
    '/:id',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.userId;
            const role = req.user!.role;

            const existing = await prisma.crmProperty.findUnique({ where: { id } });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            // BROKER/REALTOR/AGENCY может удалять только свои объекты
            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(role || '') && existing.brokerId !== userId) {
                res.status(403).json({ error: 'Нет прав на удаление этого объекта' });
                return;
            }

            // Soft delete - just archive (для BROKER и ADMIN по умолчанию)
            if (req.query.hard !== 'true') {
                await prisma.crmProperty.update({
                    where: { id },
                    data: { status: 'ARCHIVED' },
                });
                res.json({ success: true, message: 'Объект архивирован' });
                return;
            }

            // Hard delete (with ?hard=true)
            // Permission check already done above (Broker checks ownership)

            await prisma.crmProperty.delete({ where: { id } });
            res.json({ success: true, message: 'Объект удалён навсегда' });
        } catch (error) {
            console.error('Delete CRM property error:', error);
            res.status(500).json({ error: 'Ошибка удаления объекта' });
        }
    }
);


// =========================================
// POST /api/crm-properties/:id/restore - Восстановление объекта из архива
// =========================================
crmPropertiesRouter.post(
    '/:id/restore',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.userId;
            const role = req.user!.role;

            const existing = await prisma.crmProperty.findUnique({ where: { id } });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(role || '') && existing.brokerId !== userId) {
                res.status(403).json({ error: 'Нет прав на восстановление этого объекта' });
                return;
            }

            await prisma.crmProperty.update({
                where: { id },
                data: { status: 'ACTIVE' }
            });

            res.json({ success: true, message: 'Объект восстановлен из архива' });
        } catch (error) {
            console.error('Restore property error:', error);
            res.status(500).json({ error: 'Ошибка восстановления' });
        }
    }
);

// =========================================
// DELETE /api/crm-properties/:id/permanent - Полное удаление объекта
// =========================================
crmPropertiesRouter.delete(
    '/:id/permanent',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.userId;
            const role = req.user!.role;

            const existing = await prisma.crmProperty.findUnique({ where: { id } });

            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            // BROKER/REALTOR/AGENCY может удалять только свои объекты
            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(role || '') && existing.brokerId !== userId) {
                res.status(403).json({ error: 'Нет прав на удаление этого объекта' });
                return;
            }

            await prisma.crmProperty.delete({ where: { id } });
            res.json({ success: true, message: 'Объект удалён навсегда' });
        } catch (error) {
            console.error('Permanent delete property error:', error);
            res.status(500).json({ error: 'Ошибка удаления объекта' });
        }
    }
);

// =========================================
// POST /api/crm-properties/:id/recalculate-strategy - Hybrid AI Recalculation
// =========================================
crmPropertiesRouter.post(
    '/:id/recalculate-strategy',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),

    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const existing = await prisma.crmProperty.findUnique({
                where: { id },
                include: { seller: true },
            });

            if (!existing) {
                res.status(404).json({ error: 'Property not found' });
                return;
            }

            if (!existing.seller) {
                res.status(400).json({ error: 'Property has no associated seller' });
                return;
            }

            // Prepare Inputs from existing data
            const propertyInput: PropertyClassInput = {
                yearBuilt: existing.yearBuilt,
                ceilingHeight: existing.ceilingHeight ? Number(existing.ceilingHeight) : 2.7,
                buildingType: existing.buildingType as any,
                apartmentsPerFloor: existing.apartmentsPerFloor || 4,
                hasClosedTerritory: existing.hasClosedTerritory,
                totalFloors: existing.totalFloors,
                elevatorCount: existing.elevatorCount,
                hasFreightElevator: existing.hasFreightElevator,
                locationQuality: existing.locationQuality,
                glazingType: existing.glazingType,
                accessSystem: existing.accessSystem,
                facadeMaterial: existing.facadeMaterial,
                lobbyType: existing.lobbyType,
                parkingType: existing.parkingType
            };

            const liquidityInput: LiquidityInput = {
                calculatedClass: existing.calculatedClass || 'ECONOMY', // Fallback
                yearBuilt: existing.yearBuilt,
                floor: existing.floor,
                totalFloors: existing.totalFloors,
                rooms: existing.rooms,
                area: Number(existing.area?.toString() || 0),
                price: Number(existing.price.toString()),
                marketPrice: existing.marketPrice ? Number(existing.marketPrice.toString()) : null,
                repairState: existing.repairState,
                actualCondition: existing.actualCondition,
                parkingType: existing.parkingType,
                viewType: existing.viewType,
                mopState: existing.mopState,
                layoutType: existing.layoutType,
                isCorner: false,
                hasBalcony: false, // TODO
                financeType: existing.financeType,
                locationQuality: existing.locationQuality,
                elevatorCount: existing.elevatorCount
            };

            const strategyInput = {
                seller: {
                    reason: existing.seller.reason,
                    deadline: existing.seller.deadline,
                    expectedPrice: existing.seller.expectedPrice ? Number(existing.seller.expectedPrice) : null,
                    minPrice: existing.seller.minPrice ? Number(existing.seller.minPrice) : null,
                    hasDebts: existing.seller.hasDebts,
                    readyForExclusive: existing.seller.readyForExclusive,
                    trustLevel: existing.seller.trustLevel,
                    readyToFollowRecommendations: existing.seller.readyToFollowRecommendations
                },
                property: {
                    price: Number(existing.price),
                    marketPrice: existing.marketPrice ? Number(existing.marketPrice) : null,
                    financeType: existing.financeType,
                    hasLegalIssues: existing.encumbranceType !== 'NONE' || existing.isMortgaged,
                    legalIssueType: existing.encumbranceType,
                    isMortgaged: existing.isMortgaged
                }
            };

            // Call Hybrid Calculator
            const hybridResult = await calculateHybridStrategy(propertyInput, liquidityInput, strategyInput);

            const updatedProperty = await prisma.crmProperty.update({
                where: { id },
                data: {
                    activeStrategy: hybridResult.strategy,
                    strategyExplanation: hybridResult.strategyExplanation,
                    liquidityScore: hybridResult.liquidityResult.score,
                    liquidityLevel: hybridResult.liquidityResult.level
                }
            });

            // LOG IT
            await prisma.propertyCalculationLog.create({
                data: {
                    propertyId: id,
                    previousClass: existing.calculatedClass,
                    newClass: hybridResult.propertyClass,
                    previousStrategy: existing.activeStrategy,
                    newStrategy: hybridResult.strategy,
                    calculationReason: 'AI_RECALCULATION', // "AI Intervention"
                    inputData: {},
                    outputData: {
                        ...hybridResult,
                        aiReasoning: hybridResult.aiReasoning || hybridResult.strategyExplanation
                    } as any
                }
            });

            res.json({
                title: hybridResult.isAiAdjusted ? "🤖 AI изменил стратегию!" : "✅ Стратегия подтверждена",
                message: hybridResult.aiReasoning || "Стратегия соответствует рыночным условиям.",
                property: updatedProperty
            });

        } catch (error) {
            console.error('Hybrid Strategy Error:', error);
            res.status(500).json({ error: 'AI Recalculation Failed' });
        }
    }
);

// POST /api/crm-properties/:id/close - Close Deal
crmPropertiesRouter.post('/:id/close', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { offerId, finalPrice, commission, notes } = req.body;

        if (!offerId || !finalPrice) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        // Transaction for data integrity
        await prisma.$transaction(async (tx) => {
            // 1. Update Offer Status
            await tx.offer.update({
                where: { id: offerId },
                data: { status: 'ACCEPTED' }
            });

            // 2. Reject other active offers for this property
            await tx.offer.updateMany({
                where: {
                    propertyId: id,
                    id: { not: offerId },
                    status: 'PENDING'
                },
                data: { status: 'REJECTED' }
            });

            // 3. Update Property Status & Funnel
            const property = await tx.crmProperty.update({
                where: { id },
                data: {
                    status: 'SOLD',
                    funnelStage: 'SOLD' as any, // Move to SOLD stage in kanban
                    // Store the accepted offer ID for reference
                }
            });

            // 4. Update Buyer Status (via Offer)
            // Get buyer ID from offer
            const offer = await tx.offer.findUnique({ where: { id: offerId } });
            if (offer?.buyerId) {
                await tx.buyer.update({
                    where: { id: offer.buyerId },
                    data: { status: 'ARCHIVED' } // Changed from PURCHASED to ARCHIVED
                });
            }

            // 5. Update Seller Status (if all properties sold?)
            // For now simplify: Move seller to "Deal" stage if they are not there?
            // Or maybe "ARCHIVED"?
            // Let's keep seller in Contract Signing or move to a "Completed" stage if it existed.
            // Requirement says: "Close Deal" -> update property.

            // Create a log or "Deal" record if we had a Deal table.
            // For now, the successful update is enough.
        });

        res.json({ success: true, message: "Deal Closed Successfully" });

    } catch (error) {
        console.error("Close Deal Error:", error);
        res.status(500).json({ error: "Failed to close deal" });
    }
});

// =========================================
// PUT /api/crm-properties/:id/strategy - Ручная смена стратегии брокером
// =========================================
crmPropertiesRouter.put(
    '/:id/strategy',
    requireRole('BROKER', 'ADMIN', 'REALTOR', 'AGENCY', 'DEVELOPER'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { activeStrategy, resetToRecommended } = req.body;

            const existing = await prisma.crmProperty.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];
            if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            if (resetToRecommended) {
                // Сбросить на рекомендуемую системой
                const updated = await prisma.crmProperty.update({
                    where: { id },
                    data: {
                        activeStrategy: existing.recommendedStrategy,
                        isStrategyManual: false,
                    },
                });
                res.json(updated);
                return;
            }

            if (!activeStrategy) {
                res.status(400).json({ error: 'activeStrategy обязателен' });
                return;
            }

            const updated = await prisma.crmProperty.update({
                where: { id },
                data: {
                    activeStrategy,
                    isStrategyManual: true,
                },
            });

            res.json(updated);
        } catch (error) {
            console.error('Update strategy error:', error);
            res.status(500).json({ error: 'Ошибка изменения стратегии' });
        }
    }
);
