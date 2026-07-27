"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/config";
import { GraduationCap, Plus, Pencil, Trash2, Users, UserPlus, Clock, FileText } from "lucide-react";
import { FileUpload } from "@/components/file-upload";

interface Course {
  id: string;
  title: string;
  description: string | null;
  content: string;
  duration: number;
  order: number;
  isActive: boolean;
  createdAt: string;
  videoUrl: string | null;
  materials: string[];
}

interface Broker {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default function CoursesAdminPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  // Create/Edit course dialog
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    content: "",
    duration: 60,
    order: 0,
    videoUrl: "",
    materials: [] as string[],
  });

  // Assign course dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCourseForAssign, setSelectedCourseForAssign] = useState<string>("");
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role);
      if (user.role !== "ADMIN") {
        toast({ title: "Доступ запрещен", variant: "destructive" });
        router.push("/dashboard");
        return;
      }
    }
    fetchCourses();
    fetchBrokers();
  }, []);

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrokers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBrokers(data.users.filter((u: any) => u.role === "BROKER"));
      }
    } catch (error) {
      console.error("Error fetching brokers:", error);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseForm.title) {
      toast({ title: "Ошибка", description: "Введите название курса", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(courseForm),
      });

      if (res.ok) {
        toast({ title: "Успешно", description: "Курс создан" });
        setCourseDialogOpen(false);
        resetCourseForm();
        fetchCourses();
      } else {
        throw new Error("Failed to create course");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось создать курс", variant: "destructive" });
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse || !courseForm.title) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/${editingCourse.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(courseForm),
      });

      if (res.ok) {
        toast({ title: "Успешно", description: "Курс обновлен" });
        setCourseDialogOpen(false);
        setEditingCourse(null);
        resetCourseForm();
        fetchCourses();
      } else {
        throw new Error("Failed to update course");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось обновить курс", variant: "destructive" });
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Удалить курс?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/${courseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: false }),
      });

      if (res.ok) {
        toast({ title: "Успешно", description: "Курс деактивирован" });
        fetchCourses();
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось удалить курс", variant: "destructive" });
    }
  };

  const handleAssignCourse = async () => {
    if (!selectedCourseForAssign || !selectedBrokerId) {
      toast({ title: "Ошибка", description: "Выберите курс и брокера", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/courses/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: selectedCourseForAssign,
          brokerId: selectedBrokerId,
        }),
      });

      if (res.ok) {
        toast({ title: "Успешно", description: "Курс назначен брокеру" });
        setAssignDialogOpen(false);
        setSelectedCourseForAssign("");
        setSelectedBrokerId("");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign course");
      }
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message || "Не удалось назначить курс", variant: "destructive" });
    }
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      description: course.description || "",
      content: course.content,
      duration: course.duration,
      order: course.order,
      videoUrl: course.videoUrl || "",
      materials: course.materials || [],
    });
    setCourseDialogOpen(true);
  };

  const resetCourseForm = () => {
    setCourseForm({
      title: "",
      description: "",
      content: "",
      duration: 60,
      order: 0,
      videoUrl: "",
      materials: [],
    });
    setEditingCourse(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-56 bg-muted rounded animate-pulse" />
            <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
          </div>
          <div className="h-9 w-36 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Управление курсами</h1>
          <p className="text-sm text-muted-foreground">Создание и назначение курсов брокерам</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Назначить курс
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Назначить курс брокеру</DialogTitle>
                <DialogDescription>Выберите курс и брокера для назначения</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Курс</Label>
                  <Select value={selectedCourseForAssign} onValueChange={setSelectedCourseForAssign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите курс" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Брокер</Label>
                  <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите брокера" />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.map(broker => (
                        <SelectItem key={broker.id} value={broker.id}>
                          {broker.firstName} {broker.lastName} ({broker.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAssignCourse} className="bg-[#2E7D5E] hover:bg-[#256B4F] text-white">Назначить</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={courseDialogOpen} onOpenChange={(open) => {
            setCourseDialogOpen(open);
            if (!open) resetCourseForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#2E7D5E] hover:bg-[#256B4F] text-white shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Создать курс
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingCourse ? "Редактировать курс" : "Создать курс"}</DialogTitle>
                <DialogDescription>
                  {editingCourse ? "Измените данные курса" : "Заполните информацию о новом курсе"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label>Название курса *</Label>
                  <Input
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    placeholder="Основы работы брокера"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    placeholder="Краткое описание курса"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Содержание курса</Label>
                  <Textarea
                    value={courseForm.content}
                    onChange={(e) => setCourseForm({ ...courseForm, content: e.target.value })}
                    placeholder="Подробное содержание, материалы, ссылки..."
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ссылка на видео урок</Label>
                  <Input
                    value={courseForm.videoUrl || ""}
                    onChange={(e) => setCourseForm({ ...courseForm, videoUrl: e.target.value })}
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Материалы курса (Файлы)</Label>
                  <div className="border rounded-lg p-4 bg-gray-50/50">
                    <FileUpload
                      key={editingCourse?.id || 'new'}
                      category="all"
                      multiple={true}
                      existingFiles={courseForm.materials}
                      onUpload={(files) => {
                        const newUrls = files.map(f => f.url);
                        setCourseForm(prev => ({ ...prev, materials: [...prev.materials, ...newUrls] }));
                      }}
                      onRemove={(url) => {
                        setCourseForm(prev => ({ ...prev, materials: prev.materials.filter(m => m !== url) }));
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Длительность (мин)</Label>
                    <Input
                      type="number"
                      value={courseForm.duration}
                      onChange={(e) => setCourseForm({ ...courseForm, duration: parseInt(e.target.value) || 60 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Порядок</Label>
                    <Input
                      type="number"
                      value={courseForm.order}
                      onChange={(e) => setCourseForm({ ...courseForm, order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setCourseDialogOpen(false);
                  resetCourseForm();
                }}>
                  Отмена
                </Button>
                <Button onClick={editingCourse ? handleUpdateCourse : handleCreateCourse} className="bg-[#2E7D5E] hover:bg-[#256B4F] text-white">
                  {editingCourse ? "Сохранить" : "Создать"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.length === 0 ? (
          <div className="col-span-full">
            <Card className="rounded-xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-[#2E7D5E]/10 p-4 mb-4">
                  <GraduationCap className="h-10 w-10 text-[#2E7D5E]" />
                </div>
                <p className="text-lg font-medium mb-1">Курсы не созданы</p>
                <p className="text-sm text-muted-foreground mb-4">Создайте первый курс для обучения брокеров</p>
                <Button className="bg-[#2E7D5E] hover:bg-[#256B4F] text-white" onClick={() => setCourseDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать первый курс
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          courses.map((course) => (
            <Card key={course.id} className="rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-[#2E7D5E]/10 p-2 shrink-0">
                      <GraduationCap className="h-4 w-4 text-[#2E7D5E]" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight truncate">{course.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">#{course.order} • {new Date(course.createdAt).toLocaleDateString("ru-RU")}</p>
                    </div>
                  </div>
                  <Badge
                    variant={course.isActive ? "default" : "secondary"}
                    className={course.isActive ? "bg-[#2E7D5E]/15 text-[#2E7D5E] hover:bg-[#2E7D5E]/20 border-0 shrink-0" : "shrink-0"}
                  >
                    {course.isActive ? "Активен" : "Неактивен"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                {course.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {course.duration} мин
                  </span>
                  {course.materials && course.materials.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {course.materials.length} файл(ов)
                    </span>
                  )}
                </div>
              </CardContent>
              <div className="border-t px-6 py-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => openEditDialog(course)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Изменить
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteCourse(course.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Удалить
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
