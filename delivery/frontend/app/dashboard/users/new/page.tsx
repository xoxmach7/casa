'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { getApiUrl } from '@/lib/api-config';

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [agencies, setAgencies] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'BROKER',
    agencyId: '', // New field
  });

  // Fetch agencies
  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(getApiUrl('/admin/users?role=AGENCY'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAgencies(data.users || []);
        }
      } catch (e) {
        console.error("Failed to fetch agencies", e);
      }
    };
    fetchAgencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      toast({
        title: '❌ Ошибка',
        description: 'Пароль должен содержать минимум 6 символов',
        variant: 'destructive',
      });
      return;
    }

    if (formData.role === 'REALTOR' && !formData.agencyId) {
      toast({
        title: '❌ Ошибка',
        description: 'Выберите агентство для риелтора',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(getApiUrl('/admin/users'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка создания пользователя');
      }

      const data = await response.json();

      toast({
        title: '✅ Пользователь создан!',
        description: `${formData.firstName} ${formData.lastName} добавлен в систему`,
      });

      router.push('/dashboard/users');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: '❌ Ошибка',
        description: error.message || 'Не удалось создать пользователя',
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
            <Shield className="h-8 w-8" />
            Новый пользователь
          </h1>
          <p className="text-muted-foreground mt-1">
            Добавьте нового брокера, девелопера или риелтора
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Данные пользователя</CardTitle>
              <CardDescription>
                Заполните информацию о новом пользователе
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Имя *</Label>
                  <Input
                    id="firstName"
                    placeholder="Иван"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Фамилия *</Label>
                  <Input
                    id="lastName"
                    placeholder="Иванов"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ivan@casa.kz"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 (777) 123-45-67"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Пользователь сможет изменить пароль после входа
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Роль *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleChange('role', value)}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BROKER">Брокер</SelectItem>
                    <SelectItem value="DEVELOPER">Девелопер</SelectItem>
                    <SelectItem value="AGENCY">Агентство</SelectItem>
                    <SelectItem value="REALTOR">Риелтор</SelectItem>
                    <SelectItem value="ADMIN">Администратор</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground space-y-1 mt-2">
                  <p><strong>Брокер:</strong> работает с клиентами, создает брони, оформляет продажи</p>
                  <p><strong>Девелопер:</strong> создает проекты и квартиры, видит брони на свои квартиры</p>
                  <p><strong>Агентство:</strong> управляет командой риелторов, видит их сделки</p>
                  <p><strong>Риелтор:</strong> сотрудник агентства, работает с клиентами</p>
                  <p><strong>Администратор:</strong> полный доступ ко всей системе</p>
                </div>
              </div>

              {formData.role === 'REALTOR' && (
                <div className="space-y-2 border-l-4 border-blue-500 pl-4 bg-blue-50/50 p-2 rounded-r">
                  <Label htmlFor="agencyId">Агентство (Куратор) *</Label>
                  <Select
                    value={formData.agencyId}
                    onValueChange={(value) => handleChange('agencyId', value)}
                    required
                  >
                    <SelectTrigger id="agencyId">
                      <SelectValue placeholder="Выберите агентство" />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.firstName} {agency.lastName} ({agency.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Риелтор должен быть привязан к агентству
                  </p>
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
            {submitting ? 'Создание...' : 'Создать пользователя'}
          </Button>
        </div>
      </form>
    </div>
  );
}
