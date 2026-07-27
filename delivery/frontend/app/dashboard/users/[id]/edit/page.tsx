'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Shield, Save, Key, RefreshCw } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: 'BROKER',
    });

    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        if (id) {
            fetchUser();
        }
    }, [id]);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(getApiUrl(`/admin/users/${id}/full`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch user');

            const data = await response.json();
            setFormData({
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName || '',
                phone: data.phone || '',
                role: data.role
            });
        } catch (error) {
            console.error('Error fetching user:', error);
            toast({
                title: '❌ Ошибка',
                description: 'Не удалось загрузить данные пользователя',
                variant: 'destructive',
            });
            router.push('/dashboard/users');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(getApiUrl(`/admin/users/${id}`), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка обновления пользователя');
            }

            toast({
                title: '✅ Данные обновлены',
                description: 'Информация о пользователе успешно сохранена',
            });

            router.push('/dashboard/users');
        } catch (error: any) {
            console.error('Error updating user:', error);
            toast({
                title: '❌ Ошибка',
                description: error.message || 'Не удалось обновить пользователя',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            toast({
                title: "Ошибка",
                description: "Пароль должен быть минимум 6 символов",
                variant: "destructive"
            });
            return;
        }

        setResettingPassword(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(getApiUrl(`/admin/users/${id}/reset-password`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ newPassword }),
            });

            if (!response.ok) throw new Error('Failed to reset password');

            toast({
                title: "✅ Пароль изменен",
                description: "Новый пароль успешно установлен",
            });
            setNewPassword('');
        } catch (error) {
            toast({
                title: '❌ Ошибка',
                description: 'Не удалось сбросить пароль',
                variant: 'destructive',
            });
        } finally {
            setResettingPassword(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        Редактирование пользователя
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Изменение данных и прав доступа
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Main Form */}
                <form onSubmit={handleSubmit} className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Основные данные</CardTitle>
                            <CardDescription>
                                Персональная информация и настройки доступа
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">Имя *</Label>
                                    <Input
                                        id="firstName"
                                        value={formData.firstName}
                                        onChange={(e) => handleChange('firstName', e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Фамилия *</Label>
                                    <Input
                                        id="lastName"
                                        value={formData.lastName}
                                        onChange={(e) => handleChange('lastName', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email (Логин) *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Телефон</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                />
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
                                        <SelectItem value="ADMIN">Администратор</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 flex gap-2">
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Сохранить изменения
                                </Button>
                                <Button type="button" variant="outline" onClick={() => router.back()}>
                                    Отмена
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>

                {/* Password Reset Section */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Смена пароля
                        </CardTitle>
                        <CardDescription>
                            Установите новый пароль для пользователя
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Новый пароль</Label>
                            <Input
                                type="password"
                                placeholder="Минимум 6 символов"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="secondary"
                            onClick={handleResetPassword}
                            disabled={resettingPassword || newPassword.length < 6}
                            className="w-full"
                        >
                            {resettingPassword ? "Обновление..." : "Сменить пароль"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
