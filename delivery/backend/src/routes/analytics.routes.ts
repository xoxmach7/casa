import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { PropertyFunnelStage, PropertyStatus } from '@prisma/client';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

// GET /api/analytics/dashboard
analyticsRouter.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const role = req.user!.role;

        // DEVELOPER DASHBOARD LOGIC
        if (role === 'DEVELOPER') {
            const [projectsCount, apartmentsCount, bookingsCount] = await Promise.all([
                prisma.project.count({ where: { developerId: userId } }),
                prisma.apartment.count({ where: { project: { developerId: userId } } }),
                prisma.booking.count({ where: { apartment: { project: { developerId: userId } } } })
            ]);

            res.json({
                kpi: {
                    activeDeals: projectsCount, // Using activeDeals field for Projects count
                    commissionForecast: apartmentsCount, // Using commissionForecast for Apartments count
                    hotLeads: bookingsCount, // Using hotLeads for Bookings
                    conversionRate: 0
                },
                charts: {
                    funnel: [
                        { name: 'Проекты', stage: 'leads', value: projectsCount },
                        { name: 'Квартиры', stage: 'shows', value: apartmentsCount },
                        { name: 'Брони', stage: 'deal', value: bookingsCount }
                    ],
                    dynamics: []
                },
                activity: [],
                actionItems: []
            });
            return;
        }

        // Base filter for privacy
        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
        const isRestricted = restrictedRoles.includes(role);

        const whereUser: any = isRestricted ? { brokerId: userId } : {};
        const whereUserBuyer: any = isRestricted ? { brokerId: userId } : {}; // Assuming Buyer/Seller also have brokerId

        // 1. KPI Data
        const activePropertiesCount = await prisma.crmProperty.count({
            where: { status: PropertyStatus.ACTIVE, ...whereUser }
        });

        const activeProperties = await prisma.crmProperty.findMany({
            where: { status: PropertyStatus.ACTIVE, ...whereUser },
            select: { price: true }
        });

        // Approx Commission: Sum of price * 2%
        const commissionForecast = activeProperties.reduce((sum, prop) => {
            return sum + (Number(prop.price) * 0.02);
        }, 0);

        const hotLeadsCount = await prisma.buyer.count({
            where: { status: 'ACTIVE', ...whereUserBuyer }
        });

        // Conversion: (Deals / Total Created) * 100
        const totalProperties = await prisma.crmProperty.count({ where: whereUser });
        const dealProperties = await prisma.crmProperty.count({ where: { funnelStage: PropertyFunnelStage.DEAL, ...whereUser } });
        const conversionRate = totalProperties > 0 ? (dealProperties / totalProperties) * 100 : 0;

        // 2. Chart Data: Funnel
        const funnelRaw = await prisma.crmProperty.groupBy({
            by: ['funnelStage'],
            where: whereUser,
            _count: { id: true }
        });

        // Format for Recharts
        const funnelChart = [
            { name: 'Создан', stage: PropertyFunnelStage.CREATED, value: 0 },
            { name: 'Подготовка', stage: PropertyFunnelStage.PREPARATION, value: 0 },
            { name: 'Лиды', stage: PropertyFunnelStage.LEADS, value: 0 },
            { name: 'Показы', stage: PropertyFunnelStage.SHOWS, value: 0 },
            { name: 'Сделка', stage: PropertyFunnelStage.DEAL, value: 0 },
            { name: 'Продано', stage: PropertyFunnelStage.SOLD, value: 0 },
        ].map(step => {
            const found = funnelRaw.find(f => f.funnelStage === step.stage);
            return {
                ...step,
                value: found?._count.id || 0
            };
        });

        // 3. Chart Data: Dynamics (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dynamicsRaw = await prisma.crmProperty.groupBy({
            by: ['createdAt'],
            where: {
                ...whereUser,
                createdAt: { gte: thirtyDaysAgo }
            },
            _count: { id: true },
        });

        // Group by day manually since createdAt is datetime
        const dynamicsMap = new Map<string, number>();
        dynamicsRaw.forEach(item => {
            const dateStr = item.createdAt.toISOString().split('T')[0];
            dynamicsMap.set(dateStr, (dynamicsMap.get(dateStr) || 0) + item._count.id);
        });

        // Fill last 30 days
        const dynamicsChart = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dynamicsChart.push({
                date: dateStr.slice(5), // MM-DD
                value: dynamicsMap.get(dateStr) || 0
            });
        }

        // 4. Activity Feed (Last 5)
        const recentProperties = await prisma.crmProperty.findMany({
            where: whereUser,
            take: 5,
            orderBy: { updatedAt: 'desc' },
            include: { seller: true }
        });

        const activityFeed = recentProperties.map(p => ({
            id: p.id,
            type: 'PROPERTY_UPDATE',
            title: `Обновление объекта: ${p.residentialComplex}`,
            description: `Этап: ${p.funnelStage}`,
            date: p.updatedAt
        }));

        // 5. Action Items (Risky Strategies)
        const actionItems = await prisma.crmProperty.findMany({
            where: {
                ...whereUser,
                OR: [
                    { liquidityScore: { lt: 40 } },
                    { activeStrategy: 'LOW_LIQUIDITY' }
                ],
                status: PropertyStatus.ACTIVE
            },
            take: 5,
            select: { id: true, residentialComplex: true, activeStrategy: true, liquidityScore: true }
        });

        // 6. SOLD DEALS - Role-based filtering
        const soldDeals = await prisma.crmProperty.findMany({
            where: {
                ...whereUser,
                OR: [
                    { status: PropertyStatus.SOLD },
                    { funnelStage: PropertyFunnelStage.SOLD }
                ]
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
            include: {
                seller: {
                    select: {
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                },
                broker: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        // Get accepted offers for sold properties to get buyer info
        const soldPropertyIds = soldDeals.map(p => p.id);
        const acceptedOffers = await prisma.offer.findMany({
            where: {
                propertyId: { in: soldPropertyIds },
                status: 'ACCEPTED'
            },
            include: {
                buyer: {
                    select: {
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                }
            }
        });

        // Map offers to properties
        const offersMap = new Map(acceptedOffers.map(o => [o.propertyId, o]));

        const soldDealsFormatted = soldDeals.map(p => {
            const offer = offersMap.get(p.id);
            return {
                id: p.id,
                address: p.address,
                residentialComplex: p.residentialComplex,
                price: Number(p.price),
                finalPrice: offer ? Number(offer.price) : Number(p.price),
                commission: offer ? Number(offer.price) * 0.02 : Number(p.price) * 0.02,
                closedAt: p.updatedAt,
                seller: p.seller ? `${p.seller.firstName} ${p.seller.lastName}` : '—',
                buyer: offer?.buyer ? `${offer.buyer.firstName} ${offer.buyer.lastName}` : '—',
                broker: p.broker ? `${p.broker.firstName} ${p.broker.lastName}` : '—',
                brokerId: p.brokerId
            };
        });

        // 7. ADMIN ONLY: Broker Performance Breakdown
        let brokersPerformance: any[] = [];
        if (role === 'ADMIN') {
            const brokers = await prisma.user.findMany({
                where: { role: 'BROKER' },
                select: { id: true, firstName: true, lastName: true, email: true }
            });

            brokersPerformance = await Promise.all(brokers.map(async b => {
                const pCount = await prisma.crmProperty.count({ where: { brokerId: b.id } });
                const active = await prisma.crmProperty.count({ where: { brokerId: b.id, status: PropertyStatus.ACTIVE } });
                const deals = await prisma.crmProperty.count({ where: { brokerId: b.id, OR: [{ funnelStage: PropertyFunnelStage.DEAL }, { funnelStage: PropertyFunnelStage.SOLD }] } });
                const sold = await prisma.crmProperty.count({ where: { brokerId: b.id, OR: [{ status: PropertyStatus.SOLD }, { funnelStage: PropertyFunnelStage.SOLD }] } });

                const props = await prisma.crmProperty.findMany({
                    where: { brokerId: b.id, status: PropertyStatus.ACTIVE },
                    select: { price: true }
                });
                const potentialComm = props.reduce((acc, curr) => acc + (Number(curr.price) * 0.02), 0);

                return {
                    id: b.id,
                    name: `${b.firstName} ${b.lastName}`,
                    totalProperties: pCount,
                    activeProperties: active,
                    completedDeals: deals,
                    soldDeals: sold,
                    commissionForecast: potentialComm,
                    conversionRate: pCount > 0 ? (deals / pCount) * 100 : 0
                };
            }));

            brokersPerformance.sort((a, b) => b.commissionForecast - a.commissionForecast);
        }

        // ... (rest of the logic remains same)

        res.json({
            kpi: {
                activeDeals: activePropertiesCount,
                commissionForecast,
                hotLeads: hotLeadsCount,
                conversionRate: Math.round(conversionRate)
            },
            charts: {
                funnel: funnelChart,
                dynamics: dynamicsChart
            },
            activity: activityFeed,
            actionItems,
            soldDeals: soldDealsFormatted,
            brokersPerformance
        });

    } catch (error) {
        console.error("Dashboard Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});
