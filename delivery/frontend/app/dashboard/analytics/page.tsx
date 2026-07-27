'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiUrl } from '@/lib/api-config';
import { API_URL } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { ArrowUpRight, DollarSign, Users, Briefcase, Activity, AlertTriangle, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AnalyticsData {
  kpi: {
    activeDeals: number;
    commissionForecast: number;
    hotLeads: number;
    conversionRate: number;
  };
  charts: {
    funnel: { name: string; value: number }[];
    dynamics: { date: string; value: number }[];
  };
  activity: {
    id: string;
    type: string;
    title: string;
    description: string;
    date: string;
  }[];
  actionItems: {
    id: string;
    residentialComplex: string;
    activeStrategy: string;
    liquidityScore: number;
  }[];
  soldDeals: {
    id: string;
    address: string;
    residentialComplex: string;
    price: number;
    finalPrice: number;
    commission: number;
    closedAt: string;
    seller: string;
    buyer: string;
    broker: string;
  }[];
  brokersPerformance?: {
    id: string;
    name: string;
    totalProperties: number;
    activeProperties: number;
    completedDeals: number;
    commissionForecast: number;
    conversionRate: number;
  }[];
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/analytics/dashboard'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error(error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить аналитику",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-16 mt-1" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4"><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>
          <Card className="col-span-3"><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ru-KZ', {
      style: 'currency',
      currency: 'KZT',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Аналитика</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL.replace('/api','')}/api/export/analytics?format=xlsx`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'Аналитика.xlsx'; a.click();
              URL.revokeObjectURL(url);
            }
          }}>
            <Download className="mr-2 h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="deals">Сделки</TabsTrigger>
          {data.brokersPerformance && <TabsTrigger value="team">Команда</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Активные объекты</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-[#2E7D5E]/10 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-[#2E7D5E]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpi.activeDeals}</div>
                <p className="text-xs text-muted-foreground">В работе</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Прогноз комиссии</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-[#D4A843]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.kpi.commissionForecast)}</div>
                <p className="text-xs text-muted-foreground">Потенциал (2%)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Горячие лиды</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-[#3A9D73]/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-[#3A9D73]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpi.hotLeads}</div>
                <p className="text-xs text-muted-foreground">Активные покупатели</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-[#2E7D5E]/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-[#2E7D5E]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpi.conversionRate}%</div>
                <p className="text-xs text-muted-foreground">Объекты в сделки</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Воронка продаж</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={data.charts.funnel}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip
                      contentStyle={{ background: '#333', border: 'none', borderRadius: '4px', color: '#fff' }}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="value" fill="#2E7D5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Динамика новых объектов</CardTitle>
                <CardDescription>За последние 30 дней</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={data.charts.dynamics}>
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#FFD700" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Требует внимания</CardTitle>
                <CardDescription>Объекты с низкой ликвидностью</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.actionItems.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Нет критичных объектов :)</p>
                  ) : (
                    data.actionItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{item.residentialComplex}</p>
                          <p className="text-xs text-muted-foreground">Стратегия: {item.activeStrategy}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-red-500 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {item.liquidityScore}
                          </div>
                          <p className="text-xs text-muted-foreground">Ликвидность</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Недавняя активность</CardTitle>
                <CardDescription>Последние действия по объектам</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {data.activity.map(item => (
                    <div key={item.id} className="flex items-center">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {item.title[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="ml-auto font-medium text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Закрытые сделки</CardTitle>
              <CardDescription>История успешных продаж</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm text-left">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">ЖК / Адрес</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Цена продажи</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Комиссия</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Продавец</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Покупатель</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Брокер</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {data.soldDeals.map(deal => (
                      <tr key={deal.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle">
                          <div className="font-medium">{deal.residentialComplex}</div>
                          <div className="text-xs text-muted-foreground">{deal.address}</div>
                        </td>
                        <td className="p-4 align-middle font-medium">{formatCurrency(deal.finalPrice)}</td>
                        <td className="p-4 align-middle text-[#2E7D5E] font-medium">{formatCurrency(deal.commission)}</td>
                        <td className="p-4 align-middle">{deal.seller}</td>
                        <td className="p-4 align-middle">{deal.buyer}</td>
                        <td className="p-4 align-middle">{deal.broker}</td>
                        <td className="p-4 align-middle">{new Date(deal.closedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {data.brokersPerformance && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Эффективность команды</CardTitle>
                <CardDescription>Рейтинг брокеров по прогнозируемой комиссии</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {data.brokersPerformance.map((broker, idx) => (
                    <div key={broker.id} className="flex items-center">
                      <div className="w-8 h-8 flex items-center justify-center font-bold text-muted-foreground">
                        #{idx + 1}
                      </div>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{broker.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="ml-4 space-y-1 w-[200px]">
                        <p className="text-sm font-medium leading-none">{broker.name}</p>
                        <p className="text-xs text-muted-foreground">Объектов: {broker.totalProperties} | Сделок: {broker.completedDeals}</p>
                      </div>
                      <div className="ml-auto font-medium md:ml-4">
                        {formatCurrency(broker.commissionForecast)}
                      </div>
                      <div className="ml-4 text-xs text-muted-foreground w-[100px] text-right">
                        Conv: {Math.round(broker.conversionRate)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
