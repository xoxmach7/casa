"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/config";
import { User, Pencil, Lock, BookOpen, GraduationCap, Phone, Mail, MessageCircle, DollarSign, CreditCard, ChevronDown, Clock, CheckCircle2, Circle, Play, FileText, ListChecks, ExternalLink, Download, TrendingUp, Users, Target, BarChart3, Award, Building } from "lucide-react";
import DOMPurify from "dompurify";
import { Skeleton } from "@/components/ui/skeleton";

interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  createdAt: string;
  balance?: number;
  curatorName?: string;
  curatorPhone?: string;
  curatorEmail?: string;
  curatorWhatsApp?: string;
}

interface Course {
  id: number;
  title: string;
  description: string;
  content?: string;
  duration?: number;
  videoUrl?: string;
  materials?: string[];
  checklist?: string[];
  completed: boolean;
  progressPercent?: number;
  completedAt?: string;
  assignedAt: string;
}

interface PaymentHistory {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  createdAt: string;
}

interface BrokerStats {
  totalDeals: number;
  closedDeals: number;
  activeDeals: number;
  totalCommission: number;
  totalClients: number;
  activeClients: number;
  bookings: number;
  conversionRate: number;
  monthlyDeals: { month: string; count: number }[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchProfile();
    fetchCourses();
    fetchPayments();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditForm({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");

      // Fetch deals, clients, bookings in parallel
      const [dealsRes, clientsRes, bookingsRes] = await Promise.all([
        fetch(`${API_URL}/deals?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/clients?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/bookings?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let totalDeals = 0, closedDeals = 0, activeDeals = 0, totalCommission = 0;
      let totalClients = 0, activeClients = 0, bookings = 0;
      const monthlyDeals: { month: string; count: number }[] = [];

      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        const deals = dealsData.deals || dealsData || [];
        totalDeals = deals.length;
        closedDeals = deals.filter((d: any) => d.status === 'COMPLETED').length;
        activeDeals = deals.filter((d: any) => ['NEW', 'IN_PROGRESS', 'PENDING'].includes(d.status)).length;
        totalCommission = deals
          .filter((d: any) => d.status === 'COMPLETED')
          .reduce((sum: number, d: any) => sum + (parseFloat(d.commission) || 0), 0);

        // Group by month
        const monthCounts: { [key: string]: number } = {};
        deals.forEach((d: any) => {
          const month = new Date(d.createdAt).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        });
        Object.entries(monthCounts).slice(-6).forEach(([month, count]) => {
          monthlyDeals.push({ month, count });
        });
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        const clients = clientsData.clients || clientsData || [];
        totalClients = clients.length;
        activeClients = clients.filter((c: any) => ['NEW', 'IN_PROGRESS', 'INTERESTED'].includes(c.status)).length;
      }

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        const bookingsList = bookingsData.bookings || bookingsData || [];
        bookings = bookingsList.length;
      }

      const conversionRate = totalClients > 0 ? Math.round((closedDeals / totalClients) * 100) : 0;

      setStats({
        totalDeals,
        closedDeals,
        activeDeals,
        totalCommission,
        totalClients,
        activeClients,
        bookings,
        conversionRate,
        monthlyDeals
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    }
  };

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/payments/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    }
  };

  const handleEditProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          localStorage.setItem("user", JSON.stringify({ ...parsed, ...updatedUser }));
        }
        toast({ title: "Профиль обновлен", description: "Ваши данные успешно сохранены" });
        setEditDialogOpen(false);
        fetchProfile();
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось обновить профиль", variant: "destructive" });
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Ошибка", description: "Пароли не совпадают", variant: "destructive" });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({ title: "Ошибка", description: "Пароль должен содержать минимум 6 символов", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (res.ok) {
        toast({ title: "Пароль изменен", description: "Ваш пароль успешно обновлен" });
        setPasswordDialogOpen(false);
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message || "Не удалось изменить пароль", variant: "destructive" });
    }
  };

  const handleCourseToggle = async (courseId: number, completed: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/${courseId}/complete`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed }),
      });

      if (res.ok) {
        setCourses(courses.map(c =>
          c.id === courseId ? { ...c, completed, completedAt: completed ? new Date().toISOString() : undefined } : c
        ));
        toast({
          title: completed ? "Курс завершен" : "Статус изменен",
          description: completed ? "Поздравляем с завершением курса!" : "Курс отмечен как незавершенный"
        });
      } else {
        throw new Error("Failed to update course status");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось обновить статус курса", variant: "destructive" });
    }
  };

  const completedCourses = courses.filter(c => c.completed).length;
  const progressPercent = courses.length > 0 ? (completedCourses / courses.length) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-9 w-32" /><Skeleton className="h-4 w-56 mt-1" /></div>
        <Skeleton className="h-10 w-full max-w-md" />
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-56" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4,5,6].map(i => (<div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-32" /></div>))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user is admin or developer
  const isAdmin = profile?.role === 'ADMIN';
  const isDeveloper = profile?.role === 'DEVELOPER';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Профиль</h1>
        <p className="text-muted-foreground">Управление профилем и настройками</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        {isAdmin ? (
          <TabsList>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Профиль
            </TabsTrigger>
          </TabsList>
        ) : isDeveloper ? (
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Профиль
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              KPI
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Баланс
            </TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Профиль
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              KPI
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Баланс
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Обучение
            </TabsTrigger>
            <TabsTrigger value="curator" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Куратор
            </TabsTrigger>
          </TabsList>
        )}

        {/* Профиль Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Личная информация
              </CardTitle>
              <CardDescription>Ваши персональные данные</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Имя</Label>
                  <p className="font-medium">{profile?.firstName || "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Фамилия</Label>
                  <p className="font-medium">{profile?.lastName || "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Телефон</Label>
                  <p className="font-medium">{profile?.phone || "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Роль</Label>
                  <Badge variant={profile?.role === "admin" ? "default" : "secondary"}>
                    {(() => {
                      switch (profile?.role) {
                        case 'ADMIN': return 'Администратор';
                        case 'BROKER': return 'Брокер';
                        case 'REALTOR': return 'Риелтор';
                        case 'AGENCY': return 'Агентство';
                        case 'DEVELOPER': return 'Девелопер';
                        default: return profile?.role || 'Пользователь';
                      }
                    })()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Дата регистрации</Label>
                  <p className="font-medium">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("ru-RU") : "—"}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Редактировать профиль
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Редактировать профиль</DialogTitle>
                      <DialogDescription>Измените ваши персональные данные</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Имя</Label>
                        <Input
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Фамилия</Label>
                        <Input
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Телефон</Label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          placeholder="+7 (xxx) xxx-xx-xx"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button onClick={handleEditProfile}>Сохранить</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Изменить пароль
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Изменить пароль</DialogTitle>
                      <DialogDescription>Введите текущий и новый пароль</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Текущий пароль</Label>
                        <Input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Новый пароль</Label>
                        <Input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Подтверждение нового пароля</Label>
                        <Input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button onClick={handleChangePassword}>Изменить пароль</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPI / Статистика Tab */}
        <TabsContent value="stats" className="space-y-6">
          {/* KPI Cards - Role Based */}
          {profile?.role === 'DEVELOPER' ? (
            // KPI для застройщика
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Проданные квартиры
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stats?.closedDeals || 0}</div>
                  <p className="text-xs text-muted-foreground">за всё время</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Сумма продаж
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {(stats?.totalCommission || 0).toLocaleString('ru-RU')} ₸
                  </div>
                  <p className="text-xs text-muted-foreground">общая сумма</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Активные брони
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stats?.bookings || 0}</div>
                  <p className="text-xs text-muted-foreground">ожидают оплаты</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Конверсия
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stats?.conversionRate || 0}%</div>
                  <p className="text-xs text-muted-foreground">бронь → сделка</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            // KPI для брокера
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Сделки
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stats?.totalDeals || 0}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{stats?.closedDeals || 0} закрыто</span>
                    <span>•</span>
                    <span>{stats?.activeDeals || 0} активных</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Комиссия
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {(stats?.totalCommission || 0).toLocaleString('ru-RU')} ₸
                  </div>
                  <p className="text-xs text-muted-foreground">за всё время</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Клиенты
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stats?.totalClients || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.activeClients || 0} активных</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Конверсия
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{stats?.conversionRate || 0}%</div>
                  <p className="text-xs text-muted-foreground">клиент → сделка</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Детальная статистика */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Показатели</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Закрытые сделки</span>
                    <span className="font-medium">{stats?.closedDeals || 0}</span>
                  </div>
                  <Progress value={stats?.totalDeals ? (stats.closedDeals / stats.totalDeals) * 100 : 0} className="h-1.5" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Активные сделки</span>
                    <span className="font-medium">{stats?.activeDeals || 0}</span>
                  </div>
                  <Progress value={stats?.totalDeals ? (stats.activeDeals / stats.totalDeals) * 100 : 0} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Активные клиенты</span>
                  <span className="font-medium">{stats?.activeClients || 0} / {stats?.totalClients || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Месячная активность */}
            {stats?.monthlyDeals && stats.monthlyDeals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Сделки по месяцам</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-2 h-24">
                    {stats.monthlyDeals.map((item, idx) => {
                      const maxCount = Math.max(...stats.monthlyDeals.map(m => m.count), 1);
                      const heightPercent = (item.count / maxCount) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-primary/80 rounded-sm transition-all"
                            style={{ height: `${heightPercent}%`, minHeight: item.count > 0 ? '4px' : '2px' }}
                          />
                          <span className="text-[10px] text-muted-foreground">{item.month}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Баланс Tab */}
        <TabsContent value="balance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Текущий баланс
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#2E7D5E]">
                  {(profile?.balance || 0).toLocaleString("ru-RU")} ₸
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Доступно для вывода
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Статистика
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Всего получено:</span>
                    <span className="font-medium text-[#2E7D5E]">
                      +{payments.filter(p => p.type === 'income').reduce((sum, p) => sum + p.amount, 0).toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Всего выведено:</span>
                    <span className="font-medium text-red-600">
                      -{payments.filter(p => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0).toLocaleString("ru-RU")} ₸
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                История операций
              </CardTitle>
              <CardDescription>Последние транзакции</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>История операций пуста</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${payment.type === 'income' ? 'bg-[#2E7D5E]/10' : 'bg-red-100'}`}>
                          {payment.type === 'income' ? (
                            <DollarSign className="h-4 w-4 text-[#2E7D5E]" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{payment.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(payment.createdAt).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      </div>
                      <div className={`font-medium ${payment.type === 'income' ? 'text-[#2E7D5E]' : 'text-red-600'}`}>
                        {payment.type === 'income' ? '+' : '-'}{payment.amount.toLocaleString("ru-RU")} ₸
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Обучение Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Мои курсы
              </CardTitle>
              <CardDescription>
                Курсы назначенные вашим куратором. Отмечайте завершенные курсы.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Прогресс обучения</span>
                  <span className="font-medium">{completedCourses} из {courses.length} курсов</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {courses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Вам пока не назначены курсы</p>
                  <p className="text-sm">Курсы назначает ваш куратор или администратор</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {courses.map((course) => (
                    <Collapsible key={course.id} defaultOpen={!course.completed}>
                      <div className={`rounded-lg border ${course.completed ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : ''}`}>
                        {/* Course Header */}
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={course.completed}
                              onCheckedChange={(checked) => handleCourseToggle(course.id, checked as boolean)}
                            />
                            <div>
                              <p className={`font-medium ${course.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {course.title}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                {course.duration && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {course.duration} мин
                                  </span>
                                )}
                                <span>
                                  Назначен: {new Date(course.assignedAt).toLocaleDateString("ru-RU")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {course.completed ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Завершен
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Circle className="h-3 w-3 mr-1" />
                                В процессе
                              </Badge>
                            )}
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>

                        {/* Course Content */}
                        <CollapsibleContent>
                          <div className="px-4 pb-4 space-y-4 border-t">
                            {/* Description */}
                            {course.description && (
                              <div className="pt-4">
                                <p className="text-sm text-muted-foreground">{course.description}</p>
                              </div>
                            )}

                            {/* Video Lesson */}
                            {course.videoUrl && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Play className="h-4 w-4 text-red-500" />
                                  <span className="font-medium">Видеоурок</span>
                                </div>
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => window.open(course.videoUrl, '_blank')}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Смотреть видео
                                  <ExternalLink className="h-4 w-4 ml-auto" />
                                </Button>
                              </div>
                            )}

                            {/* Materials */}
                            {course.materials && course.materials.length > 0 && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium">Материалы</span>
                                </div>
                                <div className="space-y-2">
                                  {course.materials.map((material, idx) => {
                                    const fileName = material.split('/').pop() || `Документ ${idx + 1}`
                                    return (
                                      <Button
                                        key={idx}
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-between"
                                        onClick={() => window.open(material, '_blank')}
                                      >
                                        <span className="flex items-center">
                                          <FileText className="h-4 w-4 mr-2" />
                                          {fileName}
                                        </span>
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Checklist */}
                            {course.checklist && course.checklist.length > 0 && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <ListChecks className="h-4 w-4 text-green-500" />
                                  <span className="font-medium">Чек-лист</span>
                                </div>
                                <ul className="space-y-2">
                                  {course.checklist.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm">
                                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Course Content Text */}
                            {course.content && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <BookOpen className="h-4 w-4 text-purple-500" />
                                  <span className="font-medium">Содержание урока</span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.content.replace(/\n/g, '<br/>')) }} />
                                </div>
                              </div>
                            )}

                            {/* Completion info */}
                            {course.completedAt && (
                              <p className="text-sm text-green-600">
                                ✓ Завершен: {new Date(course.completedAt).toLocaleDateString("ru-RU")}
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Куратор Tab */}
        <TabsContent value="curator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Контакты куратора
              </CardTitle>
              <CardDescription>
                Свяжитесь с вашим куратором по любым вопросам
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!profile?.curatorName && !profile?.curatorPhone && !profile?.curatorEmail ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Куратор пока не назначен</p>
                  <p className="text-sm">Администратор скоро назначит вам куратора</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile?.curatorName && (
                    <div className="flex items-center gap-4 p-4 rounded-lg border">
                      <div className="p-3 rounded-full bg-primary/10">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Имя куратора</Label>
                        <p className="font-medium text-lg">{profile.curatorName}</p>
                      </div>
                    </div>
                  )}

                  {profile?.curatorPhone && (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-green-100">
                          <Phone className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Телефон</Label>
                          <p className="font-medium text-lg">{profile.curatorPhone}</p>
                        </div>
                      </div>
                      <Button variant="outline" asChild>
                        <a href={`tel:${profile.curatorPhone}`}>Позвонить</a>
                      </Button>
                    </div>
                  )}

                  {profile?.curatorEmail && (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100">
                          <Mail className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Email</Label>
                          <p className="font-medium text-lg">{profile.curatorEmail}</p>
                        </div>
                      </div>
                      <Button variant="outline" asChild>
                        <a href={`mailto:${profile.curatorEmail}`}>Написать</a>
                      </Button>
                    </div>
                  )}

                  {profile?.curatorWhatsApp && (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-green-100">
                          <MessageCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">WhatsApp</Label>
                          <p className="font-medium text-lg">{profile.curatorWhatsApp}</p>
                        </div>
                      </div>
                      <Button variant="outline" asChild>
                        <a href={`https://wa.me/${profile.curatorWhatsApp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                          Написать в WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
