"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Copy, ExternalLink, Link as LinkIcon, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";
import { BrokerLinksDialog } from "@/components/crm/forms/BrokerLinksDialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface LeadForm {
    id: string;
    title: string;
    distributionType: string;
    isActive: boolean;
    createdAt: string;
    brokers: { id: string; firstName: string; lastName: string }[];
}

export default function FormsListPage() {
    const [forms, setForms] = useState<LeadForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>('');
    const [userId, setUserId] = useState<string>('');
    const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
    const [linksDialogOpen, setLinksDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [formToDelete, setFormToDelete] = useState<LeadForm | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const u = JSON.parse(userStr);
            setUserRole(u.role);
            const id = u.id;
            setUserId(id);
        }
        fetchForms();
    }, []);

    const fetchForms = async () => {
        try {
            const res = await fetch(getApiUrl('/forms'), {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setForms(data);
        } catch (error) {
            console.error(error);
            toast.error("Ошибка загрузки форм");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (form: LeadForm) => {
        try {
            const res = await fetch(getApiUrl(`/forms/${form.id}/toggle`), {
                method: 'PATCH',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to toggle');
            const updated = await res.json();
            setForms(prev => prev.map(f => f.id === form.id ? { ...f, isActive: updated.isActive } : f));
            toast.success(updated.isActive ? "Форма активирована" : "Форма деактивирована");
        } catch (error) {
            toast.error("Ошибка изменения статуса");
        }
    };

    const handleDelete = async () => {
        if (!formToDelete) return;
        try {
            const res = await fetch(getApiUrl(`/forms/${formToDelete.id}`), {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete');
            setForms(prev => prev.filter(f => f.id !== formToDelete.id));
            toast.success("Форма удалена");
            setDeleteDialogOpen(false);
            setFormToDelete(null);
        } catch (error) {
            toast.error("Ошибка удаления формы");
        }
    };

    const visibleForms = userRole === 'BROKER'
        ? forms.filter(f => f.distributionType === 'MANUAL' && f.brokers.some(b => b.id === userId))
        : forms;

    const copyLink = (id: string, brokerId?: string) => {
        let url = `${window.location.origin}/forms/${id}`;
        if (brokerId) {
            url += `?brokerId=${brokerId}`;
        }
        navigator.clipboard.writeText(url);
        if (brokerId) {
            toast.success("Персональная ссылка скопирована", {
                description: "Заявки с этой ссылки будут закреплены за вами"
            });
        } else {
            toast.success("Общая ссылка скопирована");
        }
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Конструктор форм</h2>
                {userRole === 'ADMIN' && (
                    <div className="flex items-center space-x-2">
                        <Link href="/dashboard/forms/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Создать форму
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleForms.map((form) => (
                    <Card key={form.id} className={!form.isActive ? "opacity-60" : ""}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg font-bold">{form.title}</CardTitle>
                                <Badge variant={form.isActive ? "default" : "secondary"}>
                                    {form.isActive ? "Активна" : "Выключена"}
                                </Badge>
                            </div>
                            <CardDescription>
                                Тип: {form.distributionType === 'ROUND_ROBIN' ? 'Автоматическое' : 'Вручную'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {/* Automatic (ROUND_ROBIN) Forms */}
                                {form.distributionType === 'ROUND_ROBIN' && userRole === 'ADMIN' && (
                                    <>
                                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => copyLink(form.id)}>
                                            <Copy className="mr-2 h-3 w-3" /> Общая ссылка
                                        </Button>
                                        <Link href={`/dashboard/forms/${form.id}`} className="w-full">
                                            <Button variant="secondary" size="sm" className="w-full justify-start">
                                                <ExternalLink className="mr-2 h-3 w-3" /> Редактировать
                                            </Button>
                                        </Link>
                                    </>
                                )}

                                {/* Personal (MANUAL) Forms */}
                                {form.distributionType === 'MANUAL' && (
                                    <>
                                        {userRole === 'ADMIN' && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-start mb-2"
                                                    onClick={() => {
                                                        setSelectedForm(form);
                                                        setLinksDialogOpen(true);
                                                    }}
                                                >
                                                    <LinkIcon className="mr-2 h-3 w-3" /> Ссылки брокеров
                                                </Button>
                                                <Link href={`/dashboard/forms/${form.id}`} className="w-full">
                                                    <Button variant="secondary" size="sm" className="w-full justify-start">
                                                        <ExternalLink className="mr-2 h-3 w-3" /> Редактировать
                                                    </Button>
                                                </Link>
                                            </>
                                        )}
                                        {userRole === 'BROKER' && (
                                            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => copyLink(form.id, userId)}>
                                                <Copy className="mr-2 h-3 w-3" /> Моя персональная ссылка
                                            </Button>
                                        )}
                                    </>
                                )}

                                {/* Admin Controls: Toggle & Delete */}
                                {userRole === 'ADMIN' && (
                                    <div className="flex gap-2 pt-2 border-t mt-2">
                                        <Button
                                            variant={form.isActive ? "outline" : "default"}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleToggle(form)}
                                        >
                                            <Power className="mr-2 h-3 w-3" />
                                            {form.isActive ? "Выключить" : "Включить"}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                                setFormToDelete(form);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}

                                {/* Broker Count */}
                                {userRole === 'ADMIN' && form.brokers.length > 0 && (
                                    <div className="text-xs text-muted-foreground pt-2">
                                        {form.brokers.length} {form.brokers.length === 1 ? 'участник' : 'участников'}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {!loading && visibleForms.length === 0 && (
                    <div className="col-span-full text-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                        {userRole === 'ADMIN' ? 'Нет форм. Создайте первую!' : 'Вам пока не назначены формы.'}
                    </div>
                )}
            </div>

            <BrokerLinksDialog
                open={linksDialogOpen}
                onOpenChange={setLinksDialogOpen}
                form={selectedForm}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить форму?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы собираетесь удалить форму <strong>"{formToDelete?.title}"</strong>.
                            Это действие необратимо.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                        >
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

