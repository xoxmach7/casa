"use client";

import { useEffect, useState, useMemo } from "react";
import {
    Users,
    DollarSign,
    TrendingUp,
    Activity,
    AlertTriangle,
    Briefcase,
    CheckCircle2,
    Clock,
    ArrowRight,
    UserPlus,
    CalendarPlus,
    Home,
    Calculator,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import api from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DashboardData {
    kpi: {
        activeDeals: number;
        commissionForecast: number;
        hotLeads: number;
        conversionRate: number;
    };
    charts: {
        funnel: Array<{ name: string; stage: string; value: number }>;
        dynamics: Array<{ date: string; leads: number }>;
    };
    activity: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        date: string;
    }>;
    actionItems: Array<{
        id: string;
        residentialComplex: string;
        activeStrategy: string;
        liquidityScore: number;
    }>;
    brokersPerformance?: Array<{
        id: number;
        name: string;
        totalProperties: number;
        activeProperties: number;
        completedDeals: number;
        soldDeals: number;
        commissionForecast: number;
        conversionRate: number;
    }>;
}

export function HomePage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const userData = localStorage.getItem("user");
        if (userData) {
            setUser(JSON.parse(userData));
        }

        const fetchData = async () => {
            try {
                const res = await api.get("/analytics/dashboard");
                setData(res.data);
            } catch (error) {
                console.error("Dashboard fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Доброе утро";
        if (hour < 18) return "Добрый день";
        return "Добрый вечер";
    };

    if (loading) {
        return (
            <div className="p-8 space-y-8">
                {/* Header skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-5 w-96" />
                </div>
                {/* Quick actions skeleton */}
                <div className="flex gap-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-44 rounded-lg" />)}
                </div>
                {/* KPI skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-9 w-9 rounded-lg" />
                            </div>
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    ))}
                </div>
                {/* Chart + sidebar skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="col-span-2 rounded-xl border border-border/40 bg-card p-6 space-y-4">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72" />
                        <Skeleton className="h-72 w-full rounded-lg" />
                    </div>
                    <div className="space-y-6">
                        <div className="rounded-xl border border-border/40 bg-card p-6 space-y-4">
                            <Skeleton className="h-5 w-36" />
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex justify-between items-center py-2">
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                    <Skeleton className="h-6 w-12 rounded-full" />
                                </div>
                            ))}
                        </div>
                        <div className="rounded-xl border border-border/40 bg-card p-6 space-y-4">
                            <Skeleton className="h-5 w-44" />
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-3 py-1">
                                    <Skeleton className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
                                    <div className="space-y-1.5 flex-1">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-3 w-3/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {getGreeting()}, {user?.firstName}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Сводка вашей эффективности на сегодня
                </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/properties/new">
                    <Button size="sm" className="gap-2 bg-[#2E7D5E] hover:bg-[#256B4E] text-white shadow-sm">
                        <Home className="h-3.5 w-3.5" />Добавить объект
                    </Button>
                </Link>
                <Link href="/dashboard/mortgage">
                    <Button size="sm" variant="outline" className="gap-2 border-border/60 hover:bg-accent">
                        <Calculator className="h-3.5 w-3.5" />Ипотека
                    </Button>
                </Link>
                <Link href="/dashboard/bookings/new">
                    <Button size="sm" variant="outline" className="gap-2 border-border/60 hover:bg-accent">
                        <CalendarPlus className="h-3.5 w-3.5" />Создать бронь
                    </Button>
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title={user?.role === "DEVELOPER" ? "Проектов" : "Активные сделки"}
                    value={data?.kpi.activeDeals || 0}
                    icon={Briefcase}
                    accentColor="bg-[#2E7D5E]/10 text-[#2E7D5E]"
                    iconBg="bg-[#2E7D5E]/10"
                />
                <KpiCard
                    title={user?.role === "DEVELOPER" ? "Квартир" : "Прогноз комиссии"}
                    value={user?.role === "DEVELOPER"
                        ? (data?.kpi.commissionForecast || 0)
                        : `${(data?.kpi.commissionForecast || 0).toLocaleString()} ₸`}
                    icon={DollarSign}
                    accentColor="text-[#FFD700]"
                    iconBg="bg-[#FFD700]/10"
                />
                <KpiCard
                    title={user?.role === "DEVELOPER" ? "Броней" : "Горячие лиды"}
                    value={data?.kpi.hotLeads || 0}
                    icon={Users}
                    accentColor="text-orange-600"
                    iconBg="bg-orange-50"
                />
                <KpiCard
                    title={user?.role === "DEVELOPER" ? "Статус" : "Конверсия"}
                    value={user?.role === "DEVELOPER" ? "Active" : `${data?.kpi.conversionRate}%`}
                    icon={TrendingUp}
                    accentColor="text-[#3A9D73]"
                    iconBg="bg-[#3A9D73]/10"
                />
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                {/* Main Chart — Visual Funnel */}
                <Card className="col-span-1 lg:col-span-2 border-border/40 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-foreground">Воронка объектов</CardTitle>
                                <CardDescription className="text-xs mt-0.5">Распределение по этапам сделки</CardDescription>
                            </div>
                            <Link href="/dashboard/crm">
                                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                    Открыть CRM
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-6">
                        <FunnelVisualization data={data?.charts.funnel || []} />
                    </CardContent>
                </Card>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Action Items */}
                    <Card className="border-border/40 shadow-sm overflow-hidden">
                        <div className="h-1 bg-linear-to-r from-red-500 to-orange-400" />
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                Требует внимания
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {data?.actionItems.length === 0 ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                        <CheckCircle2 className="h-4 w-4 text-[#2E7D5E]" />
                                        Нет критических задач
                                    </div>
                                ) : (
                                    data?.actionItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-start p-2.5 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{item.residentialComplex}</p>
                                                <p className="text-xs text-red-500 font-medium mt-0.5">{
                                                    ({
                                                        LOW_LIQUIDITY: "Низкая ликвидность",
                                                        INVESTMENT_EXIT: "Выход из инвестиции",
                                                        REJECT_OBJECT: "Отказ от объекта",
                                                        URGENT_SALE: "Срочная продажа",
                                                        MARKET_SALE: "Рыночная продажа",
                                                        PREMIUM_SALE: "Премиум продажа",
                                                        STANDARD_SALE: "Стандартная продажа",
                                                        FAST_SALE: "Быстрая продажа",
                                                    } as Record<string, string>)[item.activeStrategy] || item.activeStrategy
                                                }</p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] shrink-0 ml-2 border-red-200 text-red-600 bg-red-50">
                                                Риск
                                            </Badge>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity Feed */}
                    <Card className="border-border/40 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                Недавняя активность
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {data?.activity.map((item, i) => (
                                    <div key={i} className="flex gap-3">
                                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2E7D5E] shrink-0 ring-2 ring-[#2E7D5E]/20" />
                                        <div className="space-y-0.5 min-w-0">
                                            <p className="text-sm font-medium text-foreground leading-tight truncate">{item.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                            <p className="text-[10px] text-muted-foreground/60">
                                                {new Date(item.date).toLocaleDateString("ru-RU")}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ADMIN ONLY: Brokers Performance */}
            {user?.role === 'ADMIN' && data?.brokersPerformance && data.brokersPerformance.length > 0 && (
                <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Users className="h-4 w-4 text-[#2E7D5E]" />
                            Показатели брокеров
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/40">
                                        <th className="text-left py-2.5 text-xs font-medium text-muted-foreground">Брокер</th>
                                        <th className="text-center py-2.5 text-xs font-medium text-muted-foreground">Объекты</th>
                                        <th className="text-center py-2.5 text-xs font-medium text-muted-foreground">Активные</th>
                                        <th className="text-center py-2.5 text-xs font-medium text-muted-foreground">Сделки</th>
                                        <th className="text-center py-2.5 text-xs font-medium text-muted-foreground">Продано</th>
                                        <th className="text-right py-2.5 text-xs font-medium text-muted-foreground">Комиссия</th>
                                        <th className="text-center py-2.5 text-xs font-medium text-muted-foreground">Конверсия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.brokersPerformance.map((broker) => (
                                        <tr key={broker.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                                            <td className="py-3 font-medium text-foreground">{broker.name}</td>
                                            <td className="text-center py-3 text-muted-foreground">{broker.totalProperties}</td>
                                            <td className="text-center py-3">
                                                <Badge variant="outline" className="text-[10px] bg-[#2E7D5E]/10 text-[#2E7D5E] border-[#2E7D5E]/20">
                                                    {broker.activeProperties}
                                                </Badge>
                                            </td>
                                            <td className="text-center py-3 text-muted-foreground">{broker.completedDeals}</td>
                                            <td className="text-center py-3">
                                                <Badge className="text-[10px] bg-[#2E7D5E] text-white">
                                                    {broker.soldDeals}
                                                </Badge>
                                            </td>
                                            <td className="text-right py-3 font-medium text-[#2E7D5E]">
                                                {broker.commissionForecast.toLocaleString('ru-RU')} ₸
                                            </td>
                                            <td className="text-center py-3">
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    broker.conversionRate >= 20 ? 'text-[#2E7D5E]' : 'text-muted-foreground'
                                                )}>
                                                    {broker.conversionRate.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function KpiCard({ title, value, icon: Icon, accentColor, iconBg }: any) {
    return (
        <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">{title}</span>
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
                        <Icon className={cn("h-4 w-4", accentColor)} />
                    </div>
                </div>
                <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
            </CardContent>
        </Card>
    )
}

function getBarColor(stage: string) {
    switch (stage) {
        case 'deal': return '#2E7D5E';
        case 'shows': return '#FFD700';
        case 'leads': return '#3A9D73';
        default: return '#94a3b8';
    }
}

const FUNNEL_COLORS: Record<string, { bg: string; border: string; text: string; bar: string; icon: string }> = {
    created:      { bg: 'bg-slate-50',   border: 'border-slate-200', text: 'text-slate-700',   bar: '#94a3b8', icon: '📋' },
    preparation:  { bg: 'bg-amber-50',   border: 'border-amber-200', text: 'text-amber-700',   bar: '#D4A843', icon: '🔧' },
    leads:        { bg: 'bg-blue-50',    border: 'border-blue-200',  text: 'text-[#2E7D5E]',   bar: '#3A9D73', icon: '👥' },
    shows:        { bg: 'bg-yellow-50',  border: 'border-yellow-200',text: 'text-[#B8960F]',   bar: '#FFD700', icon: '👁' },
    deal:         { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-[#2E7D5E]',  bar: '#2E7D5E', icon: '🤝' },
    sold:         { bg: 'bg-green-50',   border: 'border-green-300', text: 'text-green-700',    bar: '#1B5E40', icon: '✅' },
    cancelled:    { bg: 'bg-red-50',     border: 'border-red-200',   text: 'text-red-600',      bar: '#ef4444', icon: '❌' },
};

function getFunnelColor(stage: string) {
    return FUNNEL_COLORS[stage] || FUNNEL_COLORS['created'];
}

function FunnelVisualization({ data }: { data: Array<{ name: string; stage: string; value: number }> }) {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
    const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                    <ChevronDown className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p>Нет данных для воронки</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {/* Summary bar */}
            <div className="flex items-center justify-between px-1 mb-4">
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">{total}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Всего</div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    {data.filter(d => d.stage === 'sold' || d.stage === 'deal').map(d => (
                        <div key={d.stage} className="text-center">
                            <div className={cn("text-lg font-semibold", getFunnelColor(d.stage).text)}>{d.value}</div>
                            <div className="text-[10px] text-muted-foreground">{d.name}</div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#2E7D5E]" /> Этапы воронки
                </div>
            </div>

            {/* Funnel stages */}
            {data.map((item, index) => {
                const colors = getFunnelColor(item.stage);
                const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const widthPct = Math.max(pct, 8); // min 8% for visibility
                const shareOfTotal = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

                return (
                    <div key={item.stage} className="group relative">
                        <div className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200",
                            "hover:shadow-sm hover:scale-[1.005]",
                            colors.bg, colors.border
                        )}>
                            {/* Step number */}
                            <div className={cn(
                                "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0",
                                item.stage === 'cancelled'
                                    ? "bg-red-100 text-red-600"
                                    : "bg-[#2E7D5E]/10 text-[#2E7D5E]"
                            )}>
                                {item.stage === 'cancelled' ? '×' : index + 1}
                            </div>

                            {/* Stage name */}
                            <div className="w-24 shrink-0">
                                <div className={cn("text-sm font-medium leading-tight", colors.text)}>{item.name}</div>
                            </div>

                            {/* Progress bar */}
                            <div className="flex-1 min-w-0">
                                <div className="h-7 w-full bg-black/3 rounded-md overflow-hidden relative">
                                    <div
                                        className="h-full rounded-md transition-all duration-700 ease-out relative overflow-hidden"
                                        style={{
                                            width: `${widthPct}%`,
                                            background: `linear-gradient(90deg, ${colors.bar}ee, ${colors.bar}bb)`,
                                        }}
                                    >
                                        {/* Shimmer effect */}
                                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent" />
                                    </div>
                                </div>
                            </div>

                            {/* Count + percentage */}
                            <div className="text-right shrink-0 w-20">
                                <div className={cn("text-base font-bold tabular-nums", colors.text)}>{item.value}</div>
                                <div className="text-[10px] text-muted-foreground">{shareOfTotal}%</div>
                            </div>
                        </div>

                        {/* Connector arrow */}
                        {index < data.length - 1 && data[index + 1]?.stage !== 'cancelled' && item.stage !== 'cancelled' && (
                            <div className="flex justify-center -my-0.5 relative z-10">
                                <ChevronDown className="h-4 w-4 text-[#2E7D5E]/30" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
