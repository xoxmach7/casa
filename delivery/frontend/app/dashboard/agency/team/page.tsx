'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users, Shield, Mail, Phone, MapPin, MoreVertical, Pencil, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api-config';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Realtor {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    city: string | null;
    isActive: boolean;
    _count?: {
        deals: number;
        sellers: number;
        crmProperties: number;
    };
}

export default function AgencyTeamPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [team, setTeam] = useState<Realtor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Dialog state
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '', // Simple password setup for MVP
        phone: '',
        city: '',
    });
    const [inviting, setInviting] = useState(false);

    // Edit/Delete State
    const [editingMember, setEditingMember] = useState<Realtor | null>(null);
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        city: '',
        isActive: true
    });
    const [deletingMember, setDeletingMember] = useState<Realtor | null>(null);

    useEffect(() => {
        const fetchTeam = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(getApiUrl('/agency/team'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Failed to fetch team');

                const data = await res.json();
                setTeam(data);
            } catch (error) {
                console.error("Fetch team error:", error);
                toast({
                    title: "Ошибка",
                    description: "Не удалось загрузить список команды",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        fetchTeam();
    }, [refreshTrigger, toast]);

    const handleInvite = async () => {
        if (!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email || !inviteForm.password) {
            toast({ title: "Ошибка", description: "Заполните обязательные поля", variant: "destructive" });
            return;
        }

        setInviting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl('/agency/team'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(inviteForm)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to invite');
            }

            toast({ title: "Успешно", description: "Риелтор добавлен в команду" });
            setIsInviteOpen(false);
            setInviteForm({ firstName: '', lastName: '', email: '', password: '', phone: '', city: '' });
            setRefreshTrigger(prev => prev + 1);
        } catch (error: any) {
            toast({
                title: "Ошибка",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setInviting(false);
        }
    };

    // Handler to open the edit dialog
    const openEdit = (member: Realtor) => {
        setEditingMember(member);
        setEditForm({
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone || '',
            city: member.city || '',
            isActive: member.isActive
        });
    };

    // Handler for updating a member
    const handleUpdateMember = async () => {
        if (!editingMember) return;
        setInviting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/agency/team/${editingMember.id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });

            if (!res.ok) throw new Error('Failed to update');

            toast({ title: "Успешно", description: "Данные сотрудника обновлены" });
            setEditingMember(null);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось обновить данные", variant: "destructive" });
        } finally {
            setInviting(false);
        }
    };

    // Handler for deleting a member
    const handleDeleteMember = async () => {
        if (!deletingMember) return;
        setInviting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/agency/team/${deletingMember.id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to delete');

            toast({ title: "Успешно", description: "Сотрудник удален из команды" });
            setDeletingMember(null);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            toast({ title: "Ошибка", description: "Не удалось удалить сотрудника", variant: "destructive" });
        } finally {
            setInviting(false);
        }
    };

    const filteredTeam = team.filter(member =>
        member.firstName.toLowerCase().includes(search.toLowerCase()) ||
        member.lastName.toLowerCase().includes(search.toLowerCase()) ||
        member.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Моя команда</h2>
                    <p className="text-muted-foreground">
                        Управление риелторами агентства
                    </p>
                </div>
                <Button onClick={() => setIsInviteOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить риелтора
                </Button>
            </div>

            <div className="flex items-center py-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по имени или email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse h-40" />
                    ))}
                </div>
            ) : filteredTeam.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <Users className="mx-auto h-10 w-10 mb-4 opacity-50" />
                    <p>В вашей команде пока нет риелторов.</p>
                    <Button variant="link" onClick={() => setIsInviteOpen(true)}>
                        Добавить первого сотрудника
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTeam.map((member) => (
                        <Card key={member.id} className="overflow-hidden">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                                <div className="flex flex-row items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={`https://ui-avatars.com/api/?name=${member.firstName}+${member.lastName}&background=random`} />
                                        <AvatarFallback>{member.firstName[0]}{member.lastName[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="grid gap-1">
                                        <CardTitle className="text-lg">{member.firstName} {member.lastName}</CardTitle>
                                        <CardDescription className="text-xs flex items-center gap-1">
                                            <Badge variant="outline" className="text-xs font-normal">Риелтор</Badge>
                                            {member.isActive ? (
                                                <span className="text-green-600 text-xs flex items-center gap-0.5">● Активен</span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Неактивен</span>
                                            )}
                                        </CardDescription>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => openEdit(member)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Редактировать
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600" onClick={() => setDeletingMember(member)}>
                                            <Trash className="mr-2 h-4 w-4" />
                                            Удалить из команды
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        <span>{member.email}</span>
                                    </div>
                                    {member.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4" />
                                            <span>{member.phone}</span>
                                        </div>
                                    )}
                                    {member.city && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            <span>{member.city}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-foreground">{member._count?.sellers || 0}</div>
                                        <div className="text-xs text-muted-foreground">Продавцы</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-foreground">{member._count?.crmProperties || 0}</div>
                                        <div className="text-xs text-muted-foreground">Объекты</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-foreground">{member._count?.deals || 0}</div>
                                        <div className="text-xs text-muted-foreground">Сделки</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Invite Dialog */}
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Добавить риелтора</DialogTitle>
                        <DialogDescription>
                            Создайте учетную запись для нового члена команды.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Имя *</Label>
                                <Input
                                    id="firstName"
                                    value={inviteForm.firstName}
                                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Фамилия *</Label>
                                <Input
                                    id="lastName"
                                    value={inviteForm.lastName}
                                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Пароль *</Label>
                            <Input
                                id="password"
                                type="password"
                                value={inviteForm.password}
                                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                                placeholder="Временный пароль"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Телефон</Label>
                                <Input
                                    id="phone"
                                    value={inviteForm.phone}
                                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Город</Label>
                                <Input
                                    id="city"
                                    value={inviteForm.city}
                                    onChange={(e) => setInviteForm({ ...inviteForm, city: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Отмена</Button>
                        <Button onClick={handleInvite} disabled={inviting}>
                            {inviting ? "Добавление..." : "Добавить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Редактировать сотрудника</DialogTitle>
                        <DialogDescription>
                            Измените данные риелтора.
                        </DialogDescription>
                    </DialogHeader>
                    {editingMember && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-firstName">Имя</Label>
                                    <Input
                                        id="edit-firstName"
                                        value={editForm.firstName}
                                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-lastName">Фамилия</Label>
                                    <Input
                                        id="edit-lastName"
                                        value={editForm.lastName}
                                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-phone">Телефон</Label>
                                    <Input
                                        id="edit-phone"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-city">Город</Label>
                                    <Input
                                        id="edit-city"
                                        value={editForm.city}
                                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="edit-active">Активен</Label>
                                <input
                                    type="checkbox"
                                    id="edit-active"
                                    checked={editForm.isActive}
                                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                    className="h-4 w-4"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMember(null)}>Отмена</Button>
                        <Button onClick={handleUpdateMember} disabled={inviting}>
                            {inviting ? "Сохранение..." : "Сохранить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы собираетесь удалить {deletingMember?.firstName} {deletingMember?.lastName} из команды.
                            Это действие отключит их доступ к агентству.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMember} className="bg-red-600 hover:bg-red-700">
                            {inviting ? "Удаление..." : "Удалить"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
