'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  status: string;
  description?: string;
}

export default function EditApartmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    number: '',
    floor: '',
    rooms: '2',
    area: '',
    price: '',
    description: '',
  });

  useEffect(() => {
    fetchApartment();
  }, []);

  const fetchApartment = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        getApiUrl(`/apartments/${params.apartmentId}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch apartment');

      const apartment: Apartment = await response.json();

      setFormData({
        number: apartment.number,
        floor: apartment.floor.toString(),
        rooms: apartment.rooms.toString(),
        area: apartment.area,
        price: apartment.price,
        description: apartment.description || '',
      });
    } catch (error) {
      console.error('Error fetching apartment:', error);
      toast({
        title: '❌ Ошибка',
        description: 'Не удалось загрузить квартиру',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        getApiUrl(`/apartments/${params.apartmentId}`),
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: formData.number,
            floor: parseInt(formData.floor),
            rooms: parseInt(formData.rooms),
            area: parseFloat(formData.area),
            price: parseFloat(formData.price),
            description: formData.description || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка обновления квартиры');
      }

      toast({
        title: '✅ Квартира обновлена!',
        description: `Квартира №${formData.number} успешно обновлена`,
      });

      router.push(`/dashboard/projects/${params.id}/apartments`);
    } catch (error: any) {
      console.error('Error updating apartment:', error);
      toast({
        title: '❌ Ошибка',
        description: error.message || 'Не удалось обновить квартиру',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        getApiUrl(`/apartments/${params.apartmentId}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка удаления квартиры');
      }

      toast({
        title: '✅ Квартира удалена',
        description: 'Квартира успешно удалена из проекта',
      });

      router.push(`/dashboard/projects/${params.id}/apartments`);
    } catch (error: any) {
      console.error('Error deleting apartment:', error);
      toast({
        title: '❌ Ошибка',
        description: error.message || 'Не удалось удалить квартиру',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Home className="h-8 w-8" />
              Редактирование квартиры
            </h1>
            <p className="text-muted-foreground mt-1">
              Квартира №{formData.number}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>
                Обновите данные о квартире
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="number">Номер квартиры *</Label>
                  <Input
                    id="number"
                    placeholder="101"
                    value={formData.number}
                    onChange={(e) => handleChange('number', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="floor">Этаж *</Label>
                  <Input
                    id="floor"
                    type="number"
                    placeholder="5"
                    value={formData.floor}
                    onChange={(e) => handleChange('floor', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rooms">Количество комнат *</Label>
                  <Select
                    value={formData.rooms}
                    onValueChange={(value) => handleChange('rooms', value)}
                  >
                    <SelectTrigger id="rooms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1-комнатная</SelectItem>
                      <SelectItem value="2">2-комнатная</SelectItem>
                      <SelectItem value="3">3-комнатная</SelectItem>
                      <SelectItem value="4">4-комнатная</SelectItem>
                      <SelectItem value="5">5-комнатная</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area">Площадь (м²) *</Label>
                  <Input
                    id="area"
                    type="number"
                    step="0.1"
                    placeholder="65.5"
                    value={formData.area}
                    onChange={(e) => handleChange('area', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Цена (₸) *</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="25000000"
                  value={formData.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.price && new Intl.NumberFormat('ru-KZ', {
                    style: 'currency',
                    currency: 'KZT',
                    minimumFractionDigits: 0,
                  }).format(parseFloat(formData.price))}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Дополнительная информация о квартире..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </div>
      </form>

      {/* Диалог удаления */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить квартиру?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Квартира будет удалена из проекта навсегда.
              {formData.number && (
                <div className="mt-2 font-semibold">
                  Квартира №{formData.number}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
