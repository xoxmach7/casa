"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Save } from "lucide-react";
import Link from "next/link";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";

interface User {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
}

interface FormField {
    label: string;
    type: string;
    required: boolean;
}

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params); // Unwrap params
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [brokers, setBrokers] = useState<User[]>([]);

    // Form State
    const [title, setTitle] = useState("");
    const [distributionType, setDistributionType] = useState("MANUAL");
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
    const [fields, setFields] = useState<FormField[]>([
        { label: "Имя", type: "text", required: true },
        { label: "Телефон", type: "tel", required: true }
    ]);

    useEffect(() => {
        const loadData = async () => {
            try {
                await fetchBrokers();
                await fetchForm();
            } catch (e) {
                console.error(e);
            } finally {
                setIsFetching(false);
            }
        };
        loadData();
    }, [id]);

    const fetchBrokers = async () => {
        try {
            const res = await fetch(getApiUrl('/users?role=BROKER'), {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setBrokers(data.users || data);
            }
        } catch (error) {
            toast.error("Ошибка загрузки брокеров");
        }
    };

    const fetchForm = async () => {
        // We use the public route to get definition or admin route list? 
        // Admin list endpoint returns many, maybe we use that or add GET /:id to admin forms routes.
        // Actually forms.routes.ts DOES NOT have GET /:id for admin details explicitly, it has GET / (list) and PUT /:id.
        // But public route GET /api/public-forms/:id returns limited data.
        // I should probably rely on the list or fetch from list and find? Or add GET /:id to admin routes.
        // Validating forms.routes.ts... it has GET / (list) only.
        // I will optimistically check if I can just use the Public GET for now, but Public GET doesn't show assigned brokers clearly (Wait, schema says public GET selects `fields`, `title`. Doesn't select brokers.)
        // So I need to add GET /:id to backend or just iterate from List if state management allowed passing state.
        // Best practice: Add GET /api/forms/:id to backend.

        // For now, let's assume I'll add GET /:id to backend quickly or filter from full list?
        // Full list fetch is inefficient but works for MVP.
        const res = await fetch(getApiUrl('/forms'), { headers: getAuthHeaders() });
        const allForms = await res.json();
        const form = allForms.find((f: any) => f.id === id);

        if (form) {
            setTitle(form.title);
            setDistributionType(form.distributionType);
            setFields(form.fields as FormField[]);
            setSelectedBrokers(form.brokers.map((b: any) => b.id));
        } else {
            toast.error("Форма не найдена");
            router.push('/dashboard/forms');
        }
    };

    const handleUpdate = async () => {
        if (!title) {
            toast.error("Введите название формы");
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch(getApiUrl(`/forms/${id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    title,
                    distributionType,
                    fields,
                    brokerIds: selectedBrokers
                }),
            });

            if (!res.ok) throw new Error("Failed to update");

            toast.success("Форма обновлена");
            router.push('/dashboard/forms');
        } catch (error) {
            console.error(error);
            toast.error("Ошибка сохранения");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleBroker = (id: string) => {
        setSelectedBrokers(prev =>
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    if (isFetching) return <div className="p-8">Загрузка...</div>;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard/forms">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h2 className="text-3xl font-bold tracking-tight">Редактирование формы</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Main Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Основные настройки</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Название формы</Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>


                        {/* Auto-distribution toggle - only show for ROUND_ROBIN forms */}
                        {distributionType === 'ROUND_ROBIN' && (
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Авто-распределение (Round Robin)</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Система по очереди назначает заявки.
                                    </div>
                                </div>
                                <Switch
                                    checked={true}
                                    onCheckedChange={(checked) => setDistributionType(checked ? 'ROUND_ROBIN' : 'MANUAL')}
                                />
                            </div>
                        )}

                        {distributionType === 'MANUAL' && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="text-sm text-blue-900">
                                    <strong>Персональная форма:</strong> Заявки будут назначаться только выбранным менеджерам вручную.
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Field Editor */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Поля формы</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                                <div className="flex-1 space-y-2">
                                    <Input
                                        placeholder="Название поля"
                                        value={field.label}
                                        onChange={(e) => {
                                            const newFields = [...fields];
                                            newFields[index].label = e.target.value;
                                            setFields(newFields);
                                        }}
                                    />
                                </div>
                                <div className="w-32">
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={field.type}
                                        onChange={(e) => {
                                            const newFields = [...fields];
                                            newFields[index].type = e.target.value;
                                            setFields(newFields);
                                        }}
                                    >
                                        <option value="text">Текст</option>
                                        <option value="tel">Телефон</option>
                                        <option value="email">Email</option>
                                        <option value="number">Число</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm">Обязательно</Label>
                                    <Switch
                                        checked={field.required}
                                        onCheckedChange={(checked) => {
                                            const newFields = [...fields];
                                            newFields[index].required = checked;
                                            setFields(newFields);
                                        }}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        const newFields = fields.filter((_, i) => i !== index);
                                        setFields(newFields);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            onClick={() => {
                                setFields([...fields, { label: '', type: 'text', required: false }]);
                            }}
                            className="w-full"
                        >
                            + Добавить поле
                        </Button>
                    </CardContent>
                </Card>

                {/* Brokers Selection */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle>Доступ и Распределение</CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (selectedBrokers.length === brokers.length) {
                                    setSelectedBrokers([]);
                                } else {
                                    setSelectedBrokers(brokers.map(b => b.id));
                                }
                            }}
                            className="h-8 text-xs"
                        >
                            {selectedBrokers.length === brokers.length ? 'Снять все' : 'Выбрать всех'}
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Label>Выберите менеджеров:</Label>
                            <div className="border rounded-md p-2 h-[300px] overflow-y-auto space-y-2">
                                {brokers.map(broker => (
                                    <div
                                        key={broker.id}
                                        className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                                        onClick={() => toggleBroker(broker.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedBrokers.includes(broker.id)}
                                            onChange={() => { }}
                                            className="h-4 w-4"
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{broker.firstName} {broker.lastName}</span>
                                            <span className="text-xs text-muted-foreground">{broker.role}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Выбрано: {selectedBrokers.length} чел.
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => router.push('/dashboard/forms')}>
                        Отмена
                    </Button>
                    <Button onClick={handleUpdate} disabled={isLoading}>
                        <Save className="mr-2 h-4 w-4" />
                        {isLoading ? "Сохранение..." : "Сохранить"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
