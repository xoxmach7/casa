'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, User, Home, Clock, Check, X, AlertCircle, DollarSign, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { API_URL } from '@/lib/config';

interface Booking {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED';
  expiresAt: string;
  notes?: string;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  apartment: {
    id: string;
    number: string;
    floor: number;
    rooms: number;
    area: string;
    price: string;
    status?: 'AVAILABLE' | 'RESERVED' | 'SOLD';
    project: {
      id: string;
      name: string;
      city: string;
    };
  };
  broker: {
    firstName: string;
    lastName: string;
  };
}

const statusLabels = {
  PENDING: 'Ожидание',
  CONFIRMED: 'Подтверждена',
  CANCELLED: 'Отменена',
  EXPIRED: 'Истекла',
  COMPLETED: 'Завершена',
};

const statusColors = {
  PENDING: 'bg-yellow-500',
  CONFIRMED: 'bg-green-500',
  CANCELLED: 'bg-red-500',
  EXPIRED: 'bg-gray-500',
  COMPLETED: 'bg-blue-500',
};

export default function BookingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionType, setActionType] = useState<'confirm' | 'cancel' | 'complete' | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    try {
      console.log('Fetching bookings with filter:', statusFilter);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const url = `${API_URL}/bookings?${params.toString()}`;
      console.log('Fetching from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');

      const data = await response.json();
      console.log('Fetched bookings:', data.bookings?.length, 'items');
      setBookings(data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedBooking || !actionType) return;

    try {
      setProcessing(true);
      const token = localStorage.getItem('token');
      
      let url = `${API_URL}/bookings/${selectedBooking.id}`;
      let method = 'PUT';
      let body: any = {};

      if (actionType === 'complete') {
        // Оформление продажи
        url = `${API_URL}/bookings/${selectedBooking.id}/complete-deal`;
        method = 'POST';
        console.log('Completing deal for booking:', selectedBooking.id);
        console.log('Current booking status:', selectedBooking.status);
      } else {
        // Подтверждение или отмена
        body = {
          status: actionType === 'confirm' ? 'CONFIRMED' : 'CANCELLED',
        };
      }

      console.log('Making request:', { url, method, actionType });

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: actionType === 'complete' ? JSON.stringify({}) : JSON.stringify(body),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update booking');
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      // Показываем успешное уведомление
      if (actionType === 'complete') {
        console.log('Deal completed successfully!');
        console.log('Updated apartment status:', data.booking?.apartment?.status);
        console.log('Updated client status:', data.booking?.client?.status);
        
        // Проверяем что статусы действительно обновились
        if (data.booking?.apartment?.status === 'SOLD') {
          console.log('✅ Apartment successfully marked as SOLD');
        } else {
          console.warn('⚠️ Apartment status not SOLD:', data.booking?.apartment?.status);
        }
        
        if (data.booking?.client?.status === 'DEAL_CLOSED') {
          console.log('✅ Client successfully marked as DEAL_CLOSED');
        } else {
          console.warn('⚠️ Client status not DEAL_CLOSED:', data.booking?.client?.status);
        }
        
        toast({
          title: "🎉 Сделка оформлена!",
          description: data.message || "Квартира успешно продана. Клиент переведен в статус 'Сделка закрыта'.",
          duration: 5000,
        });
      } else if (actionType === 'confirm') {
        toast({
          title: "✅ Бронь подтверждена",
          description: "Бронирование успешно подтверждено",
        });
      } else if (actionType === 'cancel') {
        toast({
          title: "❌ Бронь отменена",
          description: "Квартира снова доступна для бронирования",
        });
      }

      console.log('Fetching updated bookings...');
      
      // Принудительно перезагружаем список с задержкой
      setTimeout(async () => {
        await fetchBookings();
        console.log('Bookings updated');
      }, 500);
      
      setSelectedBooking(null);
      setActionType(null);
    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast({
        title: "❌ Ошибка",
        description: error.message || 'Не удалось обновить бронирование',
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ru-KZ', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff < 0) return 'Истекла';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/crm?tab=bookings')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Бронирования</h1>
            <p className="text-muted-foreground">
              Управление бронями квартир
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/bookings/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Быстрое бронирование
        </Button>
      </div>

      {/* Фильтры */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все брони</SelectItem>
              <SelectItem value="PENDING">Ожидание</SelectItem>
              <SelectItem value="CONFIRMED">Подтверждена</SelectItem>
              <SelectItem value="CANCELLED">Отменена</SelectItem>
              <SelectItem value="EXPIRED">Истекла</SelectItem>
              <SelectItem value="COMPLETED">Завершена (продано)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Список бронирований */}
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    {booking.apartment.project.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Квартира №{booking.apartment.number}, {booking.apartment.rooms}-комн, {booking.apartment.area} м²
                  </CardDescription>
                </div>
                <Badge className={statusColors[booking.status]}>
                  {statusLabels[booking.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Клиент */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    Клиент
                  </div>
                  <p className="font-medium">
                    {booking.client.firstName} {booking.client.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{booking.client.phone}</p>
                </div>

                {/* Цена */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Цена</div>
                  <p className="font-medium text-lg">{formatPrice(booking.apartment.price)}</p>
                </div>

                {/* Срок */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Истекает
                  </div>
                  <p className="font-medium">{formatDate(booking.expiresAt)}</p>
                  {booking.status === 'PENDING' && (
                    <p className="text-sm text-yellow-600">
                      Осталось: {getTimeRemaining(booking.expiresAt)}
                    </p>
                  )}
                </div>

                {/* Дата создания */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    Создана
                  </div>
                  <p className="font-medium">{formatDate(booking.createdAt)}</p>
                </div>
              </div>

              {/* Заметки */}
              {booking.notes && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm">{booking.notes}</p>
                </div>
              )}

              {/* Действия */}
              {booking.status === 'PENDING' && (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setActionType('confirm');
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Подтвердить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setActionType('cancel');
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Отменить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/clients/${booking.client.id}`)}
                  >
                    Клиент
                  </Button>
                </div>
              )}

              {booking.status === 'CONFIRMED' && (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setActionType('complete');
                    }}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Оформить продажу
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/clients/${booking.client.id}`)}
                  >
                    Клиент
                  </Button>
                </div>
              )}

              {(booking.status === 'CANCELLED' || booking.status === 'EXPIRED' || booking.status === 'COMPLETED') && (
                <div className="mt-4 flex gap-2 items-center">
                  {booking.status === 'COMPLETED' && (
                    <Badge className="bg-blue-600">🎉 Сделка завершена</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/clients/${booking.client.id}`)}
                  >
                    Просмотр клиента
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">Бронирования не найдены</p>
          <p className="text-sm text-muted-foreground">
            Попробуйте изменить фильтры или создайте новое бронирование
          </p>
        </div>
      )}

      {/* Диалог подтверждения */}
      <AlertDialog
        open={!!selectedBooking && !!actionType}
        onOpenChange={() => {
          setSelectedBooking(null);
          setActionType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'confirm' && 'Подтвердить бронирование?'}
              {actionType === 'cancel' && 'Отменить бронирование?'}
              {actionType === 'complete' && '🎉 Оформить продажу квартиры?'}
            </AlertDialogTitle>
            {actionType === 'complete' ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <div>Будут выполнены следующие действия:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Квартира получит статус "ПРОДАНА"</li>
                  <li>Клиент получит статус "СДЕЛКА ЗАКРЫТА"</li>
                  <li>Квартира станет недоступна для других клиентов</li>
                </ul>
                <div className="font-semibold mt-3">Это финальный шаг сделки!</div>
              </div>
            ) : (
              <AlertDialogDescription>
                {actionType === 'confirm' && 'Квартира будет забронирована для клиента. Статус изменится на "Подтверждена".'}
                {actionType === 'cancel' && 'Квартира станет доступной для других клиентов. Это действие нельзя отменить.'}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={processing}
              className={
                actionType === 'cancel' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : actionType === 'complete'
                  ? 'bg-green-600 hover:bg-green-700'
                  : ''
              }
            >
              {processing
                ? 'Обработка...'
                : actionType === 'confirm'
                ? 'Подтвердить'
                : actionType === 'cancel'
                ? 'Отменить бронь'
                : 'Оформить продажу'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
