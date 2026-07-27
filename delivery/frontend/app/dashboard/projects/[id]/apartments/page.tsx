'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, Filter, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api-config';

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  layoutImage?: string;
  bookings: any[];
}

interface Project {
  id: string;
  name: string;
  city: string;
  address: string;
}

export default function ApartmentsGridPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [filteredApartments, setFilteredApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // Получаем роль пользователя
  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {};
  const canAddApartment = user.role === 'DEVELOPER' || user.role === 'ADMIN';

  // Фильтры
  const [roomsFilter, setRoomsFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');

  useEffect(() => {
    fetchProjectAndApartments();
  }, [params.id]);

  useEffect(() => {
    applyFilters();
  }, [apartments, roomsFilter, statusFilter, floorFilter]);

  const fetchProjectAndApartments = async () => {
    try {
      const token = localStorage.getItem('token');

      // Получаем проект
      const projectRes = await fetch(
        getApiUrl(`/projects/${params.id}`),
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const projectData = await projectRes.json();
      setProject(projectData);

      // Получаем квартиры
      const apartmentsRes = await fetch(
        getApiUrl(`/apartments?projectId=${params.id}&limit=1000`),
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const apartmentsData = await apartmentsRes.json();
      setApartments(apartmentsData.apartments);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...apartments];

    if (roomsFilter !== 'all') {
      filtered = filtered.filter((apt) => apt.rooms === parseInt(roomsFilter));
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }

    if (floorFilter !== 'all') {
      filtered = filtered.filter((apt) => apt.floor === parseInt(floorFilter));
    }

    setFilteredApartments(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 border-green-500 hover:bg-green-200 text-green-900';
      case 'RESERVED':
        return 'bg-yellow-100 border-yellow-500 hover:bg-yellow-200 text-yellow-900';
      case 'SOLD':
        return 'bg-gray-100 border-gray-500 hover:bg-gray-200 text-gray-900';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Доступно';
      case 'RESERVED':
        return 'Забронировано';
      case 'SOLD':
        return 'Продано';
      default:
        return status;
    }
  };

  const handleDeleteApartment = async () => {
    if (!apartmentToDelete) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        getApiUrl(`/apartments/${apartmentToDelete.id}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Не удалось удалить квартиру');
      }

      toast({
        title: 'Успешно',
        description: 'Квартира удалена',
      });

      // Закрыть диалог с деталями если удаленная квартира открыта
      if (selectedApartment?.id === apartmentToDelete.id) {
        setSelectedApartment(null);
      }

      // Обновить список квартир
      fetchProjectAndApartments();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setApartmentToDelete(null);
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ru-KZ', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  // Группируем квартиры по этажам
  const apartmentsByFloor = filteredApartments.reduce((acc, apt) => {
    if (!acc[apt.floor]) {
      acc[apt.floor] = [];
    }
    acc[apt.floor].push(apt);
    return acc;
  }, {} as Record<number, Apartment[]>);

  const floors = Object.keys(apartmentsByFloor)
    .map(Number)
    .sort((a, b) => b - a); // Сортируем этажи от верхнего к нижнему

  const uniqueFloors = Array.from(new Set(apartments.map((apt) => apt.floor))).sort(
    (a, b) => a - b
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Шахматка квартир</h1>
            {project && (
              <p className="text-muted-foreground">
                {project.name} - {project.city}
              </p>
            )}
          </div>
        </div>
        {canAddApartment && (
          <Button onClick={() => router.push(`/dashboard/projects/${params.id}/apartments/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить квартиру
          </Button>
        )}
      </div>

      {/* Фильтры и легенда */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Фильтры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Комнат
                </label>
                <Select value={roomsFilter} onValueChange={setRoomsFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Статус
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="AVAILABLE">Доступно</SelectItem>
                    <SelectItem value="RESERVED">Бронь</SelectItem>
                    <SelectItem value="SOLD">Продано</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Этаж
                </label>
                <Select value={floorFilter} onValueChange={setFloorFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {uniqueFloors.map((floor) => (
                      <SelectItem key={floor} value={floor.toString()}>
                        {floor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Легенда</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-green-500"></div>
                <span className="text-sm">Доступно</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-500"></div>
                <span className="text-sm">Забронировано</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-gray-500"></div>
                <span className="text-sm">Продано</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              Найдено квартир: <span className="font-bold">{filteredApartments.length}</span> из{' '}
              {apartments.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Шахматка */}
      <Card>
        <CardHeader>
          <CardTitle>Квартиры по этажам</CardTitle>
          <CardDescription>Кликните на квартиру для просмотра деталей</CardDescription>
        </CardHeader>
        <CardContent>
          {floors.length === 0 ? (
            <div className="text-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Квартиры не найдены. Попробуйте изменить фильтры.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {floors.map((floor) => (
                <div key={floor} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-base">
                      {floor} этаж
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({apartmentsByFloor[floor].length} квартир)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {apartmentsByFloor[floor]
                      .sort((a, b) => a.number.localeCompare(b.number))
                      .map((apt) => (
                        <button
                          key={apt.id}
                          onClick={() => setSelectedApartment(apt)}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${getStatusColor(
                            apt.status
                          )}`}
                        >
                          <div className="font-bold text-lg">{apt.number}</div>
                          <div className="text-xs opacity-75">{apt.rooms}-комн</div>
                          <div className="text-xs opacity-75">{apt.area} м²</div>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог с деталями квартиры */}
      <Dialog
        open={!!selectedApartment}
        onOpenChange={() => setSelectedApartment(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Квартира №{selectedApartment?.number}</DialogTitle>
            <DialogDescription>
              {selectedApartment?.rooms}-комнатная, {selectedApartment?.floor} этаж
            </DialogDescription>
          </DialogHeader>
          {selectedApartment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Площадь</p>
                  <p className="font-medium text-lg">{selectedApartment.area} м²</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Цена</p>
                  <p className="font-medium text-lg">
                    {formatPrice(selectedApartment.price)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Статус</p>
                <Badge
                  className={
                    selectedApartment.status === 'AVAILABLE'
                      ? 'bg-green-500'
                      : selectedApartment.status === 'RESERVED'
                        ? 'bg-yellow-500'
                        : 'bg-gray-500'
                  }
                >
                  {getStatusLabel(selectedApartment.status)}
                </Badge>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedApartment.status === 'AVAILABLE' && user.role !== 'DEVELOPER' && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      router.push(`/dashboard/projects/${params.id}/apartments/${selectedApartment.id}/book`);
                    }}
                  >
                    Забронировать
                  </Button>
                )}
                {canAddApartment && (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        router.push(`/dashboard/projects/${params.id}/apartments/${selectedApartment.id}/edit`);
                      }}
                    >
                      Редактировать
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setApartmentToDelete(selectedApartment);
                        setShowDeleteDialog(true);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления квартиры */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить квартиру?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены что хотите удалить квартиру №{apartmentToDelete?.number}?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteApartment}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
