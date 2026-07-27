'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, X, Image as ImageIcon } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from '@/components/file-upload';
import { getApiUrl } from '@/lib/api-config';

interface Project {
  name: string;
  description: string;
  city: string;
  address: string;
  class: string;
  deliveryDate: string;
  images: string[];
}

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<Project>({
    name: '',
    description: '',
    city: '',
    address: '',
    class: 'Комфорт',
    deliveryDate: '',
    images: [],
  });

  useEffect(() => {
    fetchProject();
  }, []);

  const fetchProject = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        getApiUrl(`/projects/${params.id}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch project');

      const data = await response.json();

      // Форматируем дату для input[type="date"]
      let deliveryDate = '';
      if (data.deliveryDate) {
        const date = new Date(data.deliveryDate);
        deliveryDate = date.toISOString().split('T')[0];
      }

      setFormData({
        name: data.name || '',
        description: data.description || '',
        city: data.city || '',
        address: data.address || '',
        class: data.class || 'Комфорт',
        deliveryDate,
        images: data.images || [],
      });
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        title: '❌ Ошибка',
        description: 'Не удалось загрузить данные проекта',
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
        getApiUrl(`/projects/${params.id}`),
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка обновления проекта');
      }

      toast({
        title: '✅ Проект обновлен!',
        description: `Изменения в "${formData.name}" успешно сохранены`,
      });

      router.push(`/dashboard/projects/${params.id}`);
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast({
        title: '❌ Ошибка',
        description: error.message || 'Не удалось обновить проект',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof Project, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRemoveImage = (urlToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter(url => url !== urlToRemove)
    }));
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Редактирование проекта</h1>
          <p className="text-muted-foreground">{formData.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>
                Измените данные о жилом комплексе
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  placeholder="ЖК Алматы Тауэрс"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Премиум класс в центре города..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Город *</Label>
                  <Input
                    id="city"
                    placeholder="Алматы"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="class">Класс</Label>
                  <Select
                    value={formData.class}
                    onValueChange={(value) => handleChange('class', value)}
                  >
                    <SelectTrigger id="class">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Эконом">Эконом</SelectItem>
                      <SelectItem value="Комфорт">Комфорт</SelectItem>
                      <SelectItem value="Бизнес">Бизнес</SelectItem>
                      <SelectItem value="Премиум">Премиум</SelectItem>
                      <SelectItem value="Элитный">Элитный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="address">Адрес *</Label>
                  <Input
                    id="address"
                    placeholder="ул. Абая, 150"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Дата сдачи</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => handleChange('deliveryDate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Фотографии проекта */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Фотографии проекта
              </CardTitle>
              <CardDescription>
                Загрузите фотографии жилого комплекса (макс. 10 фото)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Существующие фотографии */}
              {formData.images.length > 0 && (
                <div className="mb-4">
                  <Label className="mb-2 block">Текущие фотографии ({formData.images.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.images.map((url, index) => (
                      <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border">
                        <img
                          src={url}
                          alt={`Фото ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Загрузка новых фотографий */}
              <FileUpload
                existingFiles={[]}
                category="images"
                maxFiles={10 - formData.images.length}
                onUpload={(uploadedFiles) => {
                  const newUrls = uploadedFiles.map(f => f.url);
                  setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, ...newUrls]
                  }));
                }}
              />
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
    </div>
  );
}
