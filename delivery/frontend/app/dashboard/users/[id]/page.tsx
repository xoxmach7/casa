"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/config";
import { User, ArrowLeft, Phone, Mail, MessageCircle, GraduationCap, Plus, Trash2, Save, DollarSign, CheckCircle2, Circle } from "lucide-react";

interface BrokerData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  balance: number;
  curatorName: string | null;
  curatorPhone: string | null;
  curatorEmail: string | null;
  curatorWhatsApp: string | null;
  createdAt: string;
  courseProgress: CourseProgress[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  isActive: boolean;
}

interface CourseProgress {
  id: string;
  courseId: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  course: Course;
}

export default function BrokerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [broker, setBroker] = useState<BrokerData | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Curator form
  const [curatorForm, setCuratorForm] = useState({
    curatorName: "",
    curatorPhone: "",
    curatorEmail: "",
    curatorWhatsApp: "",
  });
  
  // Add course dialog
  const [addCourseDialogOpen, setAddCourseDialogOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  
  // Add payment dialog
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    type: "income" as "income" | "expense",
    description: "",
  });

  useEffect(() => {
    fetchBroker();
    fetchAllCourses();
  }, [id]);

  const fetchBroker = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/admin/users/${id}/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        if (res.status === 403) {
          toast({ title: "Доступ запрещен", variant: "destructive" });
          router.push("/dashboard/users");
          return;
        }
        throw new Error("Failed to fetch broker");
      }
      
      const data = await res.json();
      setBroker(data);
      setCuratorForm({
        curatorName: data.curatorName || "",
        curatorPhone: data.curatorPhone || "",
        curatorEmail: data.curatorEmail || "",
        curatorWhatsApp: data.curatorWhatsApp || "",
      });
    } catch (error) {
      console.error("Error fetching broker:", error);
      toast({ title: "Ошибка", description: "Не удалось загрузить данные брокера", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCourses = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllCourses(data);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const handleSaveCurator = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/admin/users/${id}/curator`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(curatorForm),
      });
      
      if (res.ok) {
        toast({ title: "Успешно", description: "Данные куратора сохранены" });
        fetchBroker();
      } else {
        throw new Error("Failed to save curator");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось сохранить данные куратора", variant: "destructive" });
    }
  };

  const handleAssignCourse = async () => {
    if (!selectedCourseId) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: selectedCourseId,
          brokerId: id,
        }),
      });
      
      if (res.ok) {
        toast({ title: "Успешно", description: "Курс назначен брокеру" });
        setAddCourseDialogOpen(false);
        setSelectedCourseId("");
        fetchBroker();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign course");
      }
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message || "Не удалось назначить курс", variant: "destructive" });
    }
  };

  const handleUnassignCourse = async (courseId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/assign/${id}/${courseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        toast({ title: "Успешно", description: "Курс удален у брокера" });
        fetchBroker();
      } else {
        throw new Error("Failed to unassign course");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось удалить курс", variant: "destructive" });
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.amount || !paymentForm.description) {
      toast({ title: "Ошибка", description: "Заполните все поля", variant: "destructive" });
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          brokerId: id,
          amount: parseFloat(paymentForm.amount),
          type: paymentForm.type,
          description: paymentForm.description,
        }),
      });
      
      if (res.ok) {
        toast({ title: "Успешно", description: "Платеж добавлен" });
        setAddPaymentDialogOpen(false);
        setPaymentForm({ amount: "", type: "income", description: "" });
        fetchBroker();
      } else {
        throw new Error("Failed to add payment");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось добавить платеж", variant: "destructive" });
    }
  };

  // Get unassigned courses
  const assignedCourseIds = broker?.courseProgress.map(cp => cp.courseId) || [];
  const unassignedCourses = allCourses.filter(c => !assignedCourseIds.includes(c.id));
  
  // Calculate progress
  const completedCourses = broker?.courseProgress.filter(cp => cp.isCompleted).length || 0;
  const totalCourses = broker?.courseProgress.length || 0;
  const progressPercent = totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!broker) {
    return (
      <div className="text-center py-8">
        <p>Брокер не найден</p>
        <Button onClick={() => router.push("/dashboard/users")} className="mt-4">
          Вернуться к списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {broker.firstName} {broker.lastName}
          </h1>
          <p className="text-muted-foreground">{broker.email}</p>
        </div>
        <Badge variant={broker.role === "ADMIN" ? "default" : "secondary"} className="ml-auto">
          {broker.role === "ADMIN" ? "Администратор" : broker.role === "BROKER" ? "Брокер" : "Девелопер"}
        </Badge>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="courses">Курсы</TabsTrigger>
          <TabsTrigger value="curator">Куратор</TabsTrigger>
          <TabsTrigger value="balance">Баланс</TabsTrigger>
        </TabsList>

        {/* Информация Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Личная информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Имя</Label>
                  <p className="font-medium">{broker.firstName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Фамилия</Label>
                  <p className="font-medium">{broker.lastName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{broker.email}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Телефон</Label>
                  <p className="font-medium">{broker.phone || "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Роль</Label>
                  <p className="font-medium">{broker.role}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Баланс</Label>
                  <p className="font-medium text-green-600">{broker.balance.toLocaleString("ru-RU")} ₸</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Курсы Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Назначенные курсы
                </CardTitle>
                <CardDescription>
                  Управление обучением брокера
                </CardDescription>
              </div>
              <Dialog open={addCourseDialogOpen} onOpenChange={setAddCourseDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Назначить курс
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Назначить курс</DialogTitle>
                    <DialogDescription>Выберите курс для назначения брокеру</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Курс</Label>
                      <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите курс" />
                        </SelectTrigger>
                        <SelectContent>
                          {unassignedCourses.length === 0 ? (
                            <SelectItem value="none" disabled>Все курсы уже назначены</SelectItem>
                          ) : (
                            unassignedCourses.map(course => (
                              <SelectItem key={course.id} value={course.id}>
                                {course.title}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddCourseDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button onClick={handleAssignCourse} disabled={!selectedCourseId || selectedCourseId === "none"}>
                      Назначить
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Прогресс обучения</span>
                  <span className="font-medium">{completedCourses} из {totalCourses} курсов</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {broker.courseProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Курсы не назначены</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {broker.courseProgress.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        {cp.isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className={`font-medium ${cp.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {cp.course.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Назначен: {new Date(cp.createdAt).toLocaleDateString("ru-RU")}
                            {cp.completedAt && ` • Завершен: ${new Date(cp.completedAt).toLocaleDateString("ru-RU")}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cp.isCompleted ? "default" : "secondary"}>
                          {cp.isCompleted ? "Завершен" : "В процессе"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnassignCourse(cp.courseId)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
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
                Данные куратора
              </CardTitle>
              <CardDescription>
                Установите контактные данные куратора для этого брокера
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Имя куратора</Label>
                  <Input
                    value={curatorForm.curatorName}
                    onChange={(e) => setCuratorForm({ ...curatorForm, curatorName: e.target.value })}
                    placeholder="Введите имя"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input
                    value={curatorForm.curatorPhone}
                    onChange={(e) => setCuratorForm({ ...curatorForm, curatorPhone: e.target.value })}
                    placeholder="+7 (xxx) xxx-xx-xx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={curatorForm.curatorEmail}
                    onChange={(e) => setCuratorForm({ ...curatorForm, curatorEmail: e.target.value })}
                    placeholder="curator@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={curatorForm.curatorWhatsApp}
                    onChange={(e) => setCuratorForm({ ...curatorForm, curatorWhatsApp: e.target.value })}
                    placeholder="+7xxxxxxxxxx"
                  />
                </div>
              </div>
              <Button onClick={handleSaveCurator} className="mt-4">
                <Save className="h-4 w-4 mr-2" />
                Сохранить данные куратора
              </Button>
            </CardContent>
          </Card>
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
                <div className="text-3xl font-bold text-green-600">
                  {broker.balance.toLocaleString("ru-RU")} ₸
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Добавить операцию</CardTitle>
              </CardHeader>
              <CardContent>
                <Dialog open={addPaymentDialogOpen} onOpenChange={setAddPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить платеж
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Добавить операцию</DialogTitle>
                      <DialogDescription>Добавьте начисление или списание для брокера</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Тип операции</Label>
                        <Select
                          value={paymentForm.type}
                          onValueChange={(v) => setPaymentForm({ ...paymentForm, type: v as "income" | "expense" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Начисление</SelectItem>
                            <SelectItem value="expense">Списание</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Сумма (₸)</Label>
                        <Input
                          type="number"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          placeholder="100000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Описание</Label>
                        <Input
                          value={paymentForm.description}
                          onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                          placeholder="Комиссия за сделку #123"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddPaymentDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button onClick={handleAddPayment}>Добавить</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
