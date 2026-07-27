'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { Label } from '@/components/ui/label';
import { getApiUrl } from '@/lib/api-config';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  project: {
    name: string;
    city: string;
  };
}

export default function BookApartmentPage() {
  const router = useRouter();
  const params = useParams();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [clientId, setClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('24');

  useEffect(() => {
    fetchData();
  }, [params.apartmentId]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Получаем квартиру
      const aptRes = await fetch(
        getApiUrl(`/apartments/${params.apartmentId}`),
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const aptData = await aptRes.json();
      setApartment(aptData);

      // Получаем клиентов брокера
      const clientsRes = await fetch(
        getApiUrl('/clients'),
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const clientsData = await clientsRes.json();
      setClients(clientsData.clients);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      setError('Выберите клиента');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      // Рассчитываем время истечения
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours));

      const response = await fetch(getApiUrl('/bookings'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          apartmentId: params.apartmentId,
          expiresAt: expiresAt.toISOString(),
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания бронирования');
      }

      // Успех! Переходим к списку бронирований
      router.push('/dashboard/bookings');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ru-KZ', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Квартира не найдена</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Бронирование квартиры</h1>
          <p className="text-muted-foreground">
            {apartment.project.name} - Квартира №{apartment.number}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Информация о квартире */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Информация о квартире
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Проект</p>
              <p className="font-medium">{apartment.project.name}</p>
              <p className="text-sm text-muted-foreground">{apartment.project.city}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Номер</p>
                <p className="font-medium">{apartment.number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Этаж</p>
                <p className="font-medium">{apartment.floor}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Комнат</p>
                <p className="font-medium">{apartment.rooms}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Площадь</p>
                <p className="font-medium">{apartment.area} м²</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Цена</p>
              <p className="text-2xl font-bold">{formatPrice(apartment.price)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Форма бронирования */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Данные бронирования
            </CardTitle>
            <CardDescription>
              Выберите клиента и укажите срок брони
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="client">Клиент *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Выберите клиента" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName} - {client.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clients.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    У вас нет клиентов.{' '}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => router.push('/dashboard/clients/new')}
                    >
                      Создать клиента
                    </Button>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires">Срок брони</Label>
                <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                  <SelectTrigger id="expires">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 часов</SelectItem>
                    <SelectItem value="24">24 часа (1 день)</SelectItem>
                    <SelectItem value="48">48 часов (2 дня)</SelectItem>
                    <SelectItem value="72">72 часа (3 дня)</SelectItem>
                    <SelectItem value="168">7 дней</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Заметки</Label>
                <Textarea
                  id="notes"
                  placeholder="Дополнительная информация о бронировании..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={submitting}
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !clientId}
                  className="flex-1"
                >
                  {submitting ? 'Создание...' : 'Забронировать'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Информация о процессе */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Как это работает
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>1.</strong> После создания бронирования квартира будет зарезервирована для выбранного клиента
            </p>
            <p>
              <strong>2.</strong> Квартира автоматически станет недоступной для других клиентов
            </p>
            <p>
              <strong>3.</strong> Бронь будет активна до указанного срока
            </p>
            <p>
              <strong>4.</strong> Вы сможете подтвердить или отменить бронирование в разделе "Бронирования"
            </p>
            <p>
              <strong>5.</strong> После истечения срока бронь автоматически отменяется, квартира снова становится доступной
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
