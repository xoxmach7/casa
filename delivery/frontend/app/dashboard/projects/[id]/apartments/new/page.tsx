'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, Upload, X, Image as ImageIcon } from 'lucide-react';
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
import { API_URL } from '@/lib/config';

export default function NewApartmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [layoutImage, setLayoutImage] = useState<string | null>(null);
  const [uploadingLayout, setUploadingLayout] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    number: '',
    floor: '',
    rooms: '2',
    area: '',
    price: '',
    description: '',
  });

  // Загрузка изображения планировки
  const handleLayoutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLayout(true);
    const token = localStorage.getItem('token');

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch(`${API_URL}/upload/single`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки изображения');
      }

      const data = await response.json();
      setLayoutImage(data.url);
      toast({
        title: 'Планировка загружена',
        description: 'Изображение успешно загружено',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить изображение',
        variant: 'destructive',
      });
    } finally {
      setUploadingLayout(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/apartments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: formData.number,
          projectId: params.id,
          floor: parseInt(formData.floor),
          rooms: parseInt(formData.rooms),
          area: parseFloat(formData.area),
          price: parseFloat(formData.price),
          status: 'AVAILABLE',
          layoutImage: layoutImage || undefined,
          description: formData.description || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка создания квартиры');
      }

      toast({
        title: '✅ Квартира создана!',
        description: `Квартира №${formData.number} успешно добавлена`,
      });

      router.push(`/dashboard/projects/${params.id}`);
    } catch (error: any) {
      console.error('Error creating apartment:', error);
      toast({
        title: '❌ Ошибка',
        description: error.message || 'Не удалось создать квартиру',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Home className="h-8 w-8" />
            Новая квартира
          </h1>
          <p className="text-muted-foreground mt-1">
            Добавьте квартиру в проект
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>
                Заполните данные о квартире
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

          {/* Секция планировки */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Планировка квартиры
              </CardTitle>
              <CardDescription>
                Загрузите изображение планировки квартиры
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLayoutUpload}
                className="hidden"
              />
              
              {layoutImage ? (
                <div className="relative">
                  <div className="aspect-square max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
                    <img
                      src={layoutImage}
                      alt="Планировка"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setLayoutImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    Нажмите на изображение чтобы заменить
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Заменить изображение
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                >
                  {uploadingLayout ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      <p className="text-muted-foreground">Загрузка...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Загрузить планировку</p>
                      <p className="text-sm text-muted-foreground">
                        PNG, JPG до 10MB
                      </p>
                    </div>
                  )}
                </div>
              )}
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
            {submitting ? 'Создание...' : 'Создать квартиру'}
          </Button>
        </div>
      </form>
    </div>
  );
}
