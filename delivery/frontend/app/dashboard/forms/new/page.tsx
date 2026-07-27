"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, Settings, Users, Bot, User } from "lucide-react";
import Link from "next/link";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Assuming these exist, if not I'll use native select or install

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
    options?: string[]; // For select fields
}

const PRESET_FIELDS = [
    { label: "Бюджет", type: "number", required: false },
    { label: "Район", type: "text", required: false },
    { label: "Тип недвижимости", type: "select", required: true, options: ["Квартира", "Дом", "Коммерция", "Участок"] },
    { label: "Количество комнат", type: "select", required: false, options: ["1", "2", "3", "4+"] },
    { label: "Комментарий", type: "textarea", required: false },
];

export default function NewFormPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [brokers, setBrokers] = useState<User[]>([]);

    // Form State
    const [title, setTitle] = useState("");
    const [distributionType, setDistributionType] = useState<"ROUND_ROBIN" | "MANUAL">("ROUND_ROBIN");
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);

    const [fields, setFields] = useState<FormField[]>([
        { label: "Имя", type: "text", required: true },
        { label: "Телефон", type: "tel", required: true }
    ]);

    useEffect(() => {
        fetchBrokers();
    }, []);

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
            console.error(error);
        }
    };

    const toggleAllBrokers = () => {
        if (selectedBrokers.length === brokers.length) {
            setSelectedBrokers([]);
        } else {
            setSelectedBrokers(brokers.map(b => b.id));
        }
    };

    const handleCreate = async () => {
        if (!title) {
            toast.error("Введите название формы");
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch(getApiUrl('/forms'), {
                method: 'POST',
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

            if (!res.ok) throw new Error("Failed to create");

            toast.success("Форма создана");
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

    const addField = (preset?: FormField) => {
        if (fields.length >= 10) {
            toast.error("Максимум 10 полей");
            return;
        }
        if (preset) {
            setFields([...fields, { ...preset }]);
        } else {
            setFields([...fields, { label: "Новое поле", type: "text", required: false }]);
        }
    };

    const removeField = (index: number) => {
        if (fields.length <= 1) {
            toast.error("Должно быть минимум 1 поле");
            return;
        }
        setFields(fields.filter((_, i) => i !== index));
    };

    const updateField = (index: number, key: keyof FormField, value: any) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [key]: value };
        setFields(newFields);
    };

    // --- STEP 1: Selection ---
    if (step === 1) {
        return (
            <div className="flex-1 p-8 pt-6 max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard/forms">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Создание формы</h2>
                        <p className="text-muted-foreground">Шаг 1: Выберите тип распределения заявок</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <Card
                        className={`cursor-pointer transition-all border-2 hover:border-primary/50 hover:bg-muted/10 ${distributionType === 'ROUND_ROBIN' ? 'border-primary ring-1 ring-primary' : 'border-muted'}`}
                        onClick={() => {
                            setDistributionType('ROUND_ROBIN');
                            setStep(2);
                        }}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    <Bot className="h-6 w-6" />
                                </div>
                                <CardTitle>Общая ссылка (Авто)</CardTitle>
                            </div>
                            <CardDescription className="text-base">
                                Единая ссылка для рекламы и ботов. Заявки автоматически распределяются между менеджерами по очереди (Round Robin).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                <li>Идеально для трафика из Instagram/Google</li>
                                <li>Равномерное распределение лидов</li>
                                <li>Можно исключить неактивных менеджеров</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card
                        className={`cursor-pointer transition-all border-2 hover:border-primary/50 hover:bg-muted/10 ${distributionType === 'MANUAL' ? 'border-primary ring-1 ring-primary' : 'border-muted'}`}
                        onClick={() => {
                            setDistributionType('MANUAL');
                            setStep(2);
                        }}
                    >
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <User className="h-6 w-6" />
                                </div>
                                <CardTitle>Персональные ссылки</CardTitle>
                            </div>
                            <CardDescription className="text-base">
                                Каждый менеджер получает свою уникальную ссылку. Заявка с такой ссылки попадает строго этому менеджеру.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                <li>Для личных профилей менеджеров</li>
                                <li>Для визиток и QR-кодов</li>
                                <li>Распределение без очереди</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // --- STEP 2: Configuration ---
    return (
        <div className="flex-1 space-y-4 p-8 pt-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Настройка формы</h2>
                    <p className="text-muted-foreground">
                        {distributionType === 'ROUND_ROBIN' ? 'Автоматическое распределение' : 'Персональные ссылки'}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column: Settings */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Основные</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Название формы</Label>
                                <Input
                                    placeholder="Например: Лиды с Инстаграм"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>


                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle>Участники</CardTitle>
                                <CardDescription>Кто получает заявки</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={toggleAllBrokers} className="h-8 text-xs">
                                {selectedBrokers.length === brokers.length ? 'Снять все' : 'Выбрать всех'}
                            </Button>
                        </CardHeader>
                        <CardContent>
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
                            <div className="mt-2 text-xs text-muted-foreground">
                                Выбрано: {selectedBrokers.length} из {brokers.length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Field Builder */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Конструктор полей ({fields.length}/10)</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => addField()}>
                                    <Plus className="h-4 w-4 mr-2" /> Свое поле
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-1">
                            {/* Visual List of Fields */}
                            <div className="space-y-4">
                                {fields.map((field, idx) => (
                                    <div key={idx} className="flex gap-3 items-start p-3 border rounded-lg bg-muted/20 group">
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Название поля</Label>
                                                <Input
                                                    value={field.label}
                                                    onChange={(e) => updateField(idx, 'label', e.target.value)}
                                                    className="h-8"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Тип</Label>
                                                <select
                                                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                    value={field.type}
                                                    onChange={(e) => updateField(idx, 'type', e.target.value)}
                                                >
                                                    <option value="text">Текст</option>
                                                    <option value="tel">Телефон</option>
                                                    <option value="number">Число</option>
                                                    <option value="email">Email</option>
                                                    <option value="select">Выбор (список)</option>
                                                    <option value="textarea">Многострочный</option>
                                                </select>
                                            </div>

                                            {field.type === 'select' && (
                                                <div className="col-span-2 space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Варианты (через запятую)</Label>
                                                    <Input
                                                        value={field.options?.join(', ') || ''}
                                                        onChange={(e) => updateField(idx, 'options', e.target.value.split(',').map(s => s.trim()))}
                                                        className="h-8"
                                                        placeholder="Квартира, Дом, Участок"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-center gap-2 pt-5">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={field.required}
                                                    onChange={(e) => updateField(idx, 'required', e.target.checked)}
                                                    className="h-4 w-4"
                                                    title="Обязательное"
                                                />
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-50 hover:opacity-100" onClick={() => removeField(idx)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Presets */}
                            <div className="pt-4 border-t">
                                <Label className="text-sm font-medium mb-3 block text-muted-foreground">Быстрое добавление:</Label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_FIELDS.map((preset) => (
                                        <Button
                                            key={preset.label}
                                            variant="secondary"
                                            size="sm"
                                            className="text-xs border"
                                            onClick={() => addField(preset)}
                                        >
                                            + {preset.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer Actions */}
                <div className="lg:col-span-3 flex justify-end gap-3 pt-6 border-t">
                    <Button variant="outline" onClick={() => router.push('/dashboard/forms')}>
                        Отмена
                    </Button>
                    <Button onClick={handleCreate} disabled={isLoading} size="lg">
                        {isLoading ? "Создание..." : "Создать форму"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
