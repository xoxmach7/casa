"use client";

import { useForm, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { CreateSellerValues, createSellerSchema } from "@/lib/schemas";
import api from "@/lib/api-client";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Clock, DollarSign, Home, MessageSquare, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriceInput } from "@/components/ui/price-input";

interface CreateSellerFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Partial<CreateSellerValues> & { id?: string };
    onSuccess?: () => void;
    activeFunnelId?: string | null;
}

const REASONS = [
    { value: "SIZE_CHANGE", label: "Улучшение/смена жилья" },
    { value: "RELOCATION", label: "Переезд" },
    { value: "INVESTMENT", label: "Инвестиционная продажа" },
    { value: "DIVORCE", label: "Развод" },
    { value: "INHERITANCE", label: "Наследство" },
    { value: "FINANCIAL_NEED", label: "Финансовая необходимость" },
    { value: "OTHER", label: "Другое" },
];

const DEADLINES = [
    { value: "URGENT_30_DAYS", label: "Срочно (до 1 месяца)" },
    { value: "NORMAL_90_DAYS", label: "1-3 месяца" },
    { value: "FLEXIBLE_180_DAYS", label: "Более 3 месяцев" },
    { value: "NO_RUSH", label: "Не спешу" },
];

const MARKET_ASSESSMENTS = [
    { value: "ADEQUATE", label: "Адекватная" },
    { value: "OVERPRICED", label: "Завышенная" },
    { value: "UNCERTAIN", label: "Не знаю рынок" },
];

const PURCHASE_FORMATS = [
    { value: "NEW_BUILDING", label: "Новостройка" },
    { value: "SECONDARY", label: "Вторичка" },
    { value: "HOUSE", label: "Дом" },
    { value: "NOT_DECIDED", label: "Не определился" },
];

const INCOME_SOURCES = [
    { value: "EMPLOYMENT", label: "Наемный работник" },
    { value: "BUSINESS", label: "Бизнес" },
    { value: "RENTAL_INCOME", label: "Рента" },
    { value: "PENSION", label: "Пенсия" },
    { value: "OTHER", label: "Другое" },
];

const COMMUNICATION_CHANNELS = [
    { value: "CALL", label: "Звонок" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "TELEGRAM", label: "Telegram" },
];

const SOURCES = [
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "REFERRAL", label: "Рекомендация" },
    { value: "WEBSITE", label: "Сайт" },
    { value: "OTHER", label: "Другое" },
];

export function CreateSellerForm({ open, onOpenChange, initialData, onSuccess, activeFunnelId }: CreateSellerFormProps) {
    const props = { open, onOpenChange, initialData, onSuccess, activeFunnelId };
    const queryClient = useQueryClient();
    const isEditMode = !!initialData?.id;

    const [expandedSections, setExpandedSections] = useState<string[]>(["basic", "reason", "price", "plans", "communication"]);

    const [phoneCheckResult, setPhoneCheckResult] = useState<{
        exists: boolean;
        seller?: {
            id: string;
            name: string;
            firstName?: string;
            lastName?: string;
            middleName?: string;
        }
    } | null>(null);
    const [isCheckingPhone, setIsCheckingPhone] = useState(false);

    const form = useForm<CreateSellerValues>({
        resolver: zodResolver(createSellerSchema) as any,
        defaultValues: {
            firstName: initialData?.firstName || "",
            lastName: initialData?.lastName || "",
            phone: initialData?.phone || "+7",
            city: initialData?.city || "",
            source: initialData?.source || "",
            managerComment: initialData?.managerComment || "",
            readyToNegotiate: initialData?.readyToNegotiate ?? true,
            plansToPurchase: initialData?.plansToPurchase ?? false,
            hasDebts: initialData?.hasDebts ?? false,
            trustLevel: initialData?.trustLevel ?? 3,
            reason: initialData?.reason as any,
            deadline: initialData?.deadline as any,
            expectedPrice: initialData?.expectedPrice,
            minPrice: initialData?.minPrice,
            marketAssessment: initialData?.marketAssessment as any,
            nextPurchaseFormat: initialData?.nextPurchaseFormat as any,
            purchaseBudget: initialData?.purchaseBudget,
            loanPaymentAmount: initialData?.loanPaymentAmount,
            communicationChannel: initialData?.communicationChannel || "",
            preferredTime: initialData?.preferredTime || "",
            reasonOther: initialData?.reasonOther || "",
            customStageId: initialData?.customStageId || "",
            projectId: initialData?.projectId || "",
            apartmentId: initialData?.apartmentId || "",
        },
    });

    const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
        queryKey: ["projects"],
        queryFn: async () => {
            const res = await api.get("/projects");
            return res.data;
        },
    });
    const projects = projectsData?.projects || [];

    useEffect(() => {
        if (open && initialData) {
            form.reset({
                firstName: initialData.firstName || "",
                lastName: initialData.lastName || "",
                phone: initialData.phone || "+7",
                city: initialData.city || "",
                source: initialData.source || "",
                managerComment: initialData.managerComment || "",
                readyToNegotiate: initialData.readyToNegotiate ?? true,
                plansToPurchase: initialData.plansToPurchase ?? false,
                hasDebts: initialData.hasDebts ?? false,
                trustLevel: initialData.trustLevel ?? 3,
                reason: initialData.reason as any,
                deadline: initialData.deadline as any,
                expectedPrice: initialData.expectedPrice ?? undefined,
                minPrice: initialData.minPrice ?? undefined,
                marketAssessment: initialData.marketAssessment as any,
                nextPurchaseFormat: initialData.nextPurchaseFormat as any,
                purchaseBudget: initialData.purchaseBudget ?? undefined,
                loanPaymentAmount: initialData.loanPaymentAmount ?? undefined,
                communicationChannel: initialData.communicationChannel || "",
                preferredTime: initialData.preferredTime || "",
                reasonOther: initialData.reasonOther || "",
                customStageId: initialData.customStageId || "",
                projectId: initialData.projectId || "",
                apartmentId: initialData.apartmentId || "",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, open]);

    const plansToPurchase = useWatch({ control: form.control, name: "plansToPurchase" });
    const phoneValue = useWatch({ control: form.control, name: "phone" });

    useEffect(() => {
        if (!phoneValue || phoneValue.length < 12 || isEditMode) {
            setPhoneCheckResult(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsCheckingPhone(true);
            try {
                const res = await api.get('/sellers/check-phone', { params: { phone: phoneValue } });
                setPhoneCheckResult(res.data);
            } catch (error) {
                console.error('Phone check error:', error);
                setPhoneCheckResult(null);
            } finally {
                setIsCheckingPhone(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [phoneValue, isEditMode]);
    const hasDebts = useWatch({ control: form.control, name: "hasDebts" });
    const reason = useWatch({ control: form.control, name: "reason" });

    const mutation = useMutation({
        mutationFn: async (data: CreateSellerValues) => {
            if (isEditMode && initialData?.id) {
                return api.put(`/sellers/${initialData.id}`, data);
            }
            return api.post("/sellers", { ...data, funnelId: activeFunnelId || undefined });
        },
        onSuccess: () => {
            toast.success(isEditMode ? "Продавец обновлён" : "Продавец успешно создан");
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            onOpenChange(false);
            if (!isEditMode) form.reset();
            if (props.onSuccess) props.onSuccess();
        },
        onError: (error: any) => {
            const errorData = error.response?.data;
            const errorMessage = errorData?.error || errorData?.message || "Ошибка сохранения";

            if (errorData?.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
                toast.error(`${errorMessage}: ${errorData.details[0].message} (${errorData.details[0].field})`);
            } else {
                toast.error(errorMessage);
            }
        },
    });

    function onInvalid(errors: any) {
        console.error("Form validation errors:", errors);

        const sectionsToOpen = new Set(expandedSections);
        const errorKeys = Object.keys(errors);

        errorKeys.forEach(key => {
            if (["firstName", "lastName", "phone", "city", "source", "managerComment"].includes(key)) sectionsToOpen.add("basic");
            if (["reason", "deadline", "reasonOther"].includes(key)) sectionsToOpen.add("reason");
            if (["expectedPrice", "minPrice", "readyToNegotiate", "marketAssessment"].includes(key)) sectionsToOpen.add("price");
            if (["plansToPurchase", "nextPurchaseFormat", "purchaseBudget", "hasDebts", "loanPaymentAmount"].includes(key)) sectionsToOpen.add("plans");
            if (["communicationChannel", "preferredTime"].includes(key)) sectionsToOpen.add("communication");
        });

        setExpandedSections(Array.from(sectionsToOpen));

        const missingFields = errorKeys.map(field => {
            const map: Record<string, string> = {
                firstName: "Имя",
                lastName: "Фамилия",
                phone: "Телефон",
                source: "Источник",
                reason: "Причина продажи",
                deadline: "Срочность",
                expectedPrice: "Желаемая цена",
                minPrice: "Минимальная цена",
                purchaseBudget: "Бюджет покупки",
                communicationChannel: "Канал связи",
                preferredTime: "Удобное время",
                reasonOther: "Уточнение причины",
                managerComment: "Комментарий"
            };
            const label = map[field] || field;
            const msg = errors[field]?.message;
            return msg ? `${label} (${msg})` : label;
        });

        toast.error(`Исправьте ошибки (${missingFields.length}):`, {
            description: missingFields.join(", "),
            duration: 6000,
        });
    }

    function onSubmit(data: CreateSellerValues) {
        mutation.mutate(data);
    }

    // Calculate progress
    const watchedValues = useWatch({ control: form.control });
    const progress = calculateProgress(watchedValues);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-3xl bg-gray-50 p-0 gap-0 overflow-hidden">
                <div className="p-6 bg-white border-b shrink-0 z-20 shadow-sm">
                    <SheetHeader>
                        <SheetTitle>
                            {isEditMode ? "Редактирование продавца" : "Новый продавец"}
                        </SheetTitle>
                        <SheetDescription>
                            {isEditMode
                                ? "Обновите данные для актуализации стратегии."
                                : "Заполните основные данные о клиенте и его запросе."}
                        </SheetDescription>
                    </SheetHeader>

                    {isEditMode && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                                <span>Заполнено: {progress.completed} из {progress.total} блоков</span>
                                <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 scroll-smooth min-h-0">
                    <Form {...form}>
                        <form id="create-seller-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 pb-6">

                            {/* NEW SELLER: Simple Flat Form */}
                            {!isEditMode && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="firstName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Имя</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Имя" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="lastName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Фамилия</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Фамилия" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Телефон</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="+7 (700) 000-00-00"
                                                            {...field}
                                                            maxLength={18}
                                                            className={phoneCheckResult?.exists ? "border-amber-500 focus-visible:ring-amber-500" : ""}
                                                            onChange={(e) => {
                                                                let val = e.target.value.replace(/\D/g, '');
                                                                if (val.startsWith('7')) val = val.substring(1);

                                                                let formatted = '+7';
                                                                if (val.length > 0) formatted += ' (' + val.substring(0, 3);
                                                                if (val.length >= 4) formatted += ') ' + val.substring(3, 6);
                                                                if (val.length >= 7) formatted += '-' + val.substring(6, 8);
                                                                if (val.length >= 9) formatted += '-' + val.substring(8, 10);

                                                                field.onChange(formatted);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    {isCheckingPhone && (
                                                        <p className="text-sm text-muted-foreground">Проверяем номер...</p>
                                                    )}
                                                    {!isCheckingPhone && phoneCheckResult?.exists && (
                                                        <div className="flex flex-col gap-2 mt-2">
                                                            <p className="text-sm text-amber-600 font-medium">
                                                                ⚠️ Клиент с таким номером уже есть: {phoneCheckResult.seller?.name}
                                                            </p>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full text-amber-600 border-amber-200 hover:bg-amber-50"
                                                                onClick={() => {
                                                                    if (phoneCheckResult.seller) {
                                                                        form.setValue("firstName", phoneCheckResult.seller.firstName || "");
                                                                        form.setValue("lastName", phoneCheckResult.seller.lastName || "");
                                                                        toast.info("Данные клиента заполнены");
                                                                    }
                                                                }}
                                                            >
                                                                Заполнить данные клиента
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="reason"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Вопрос / Тема (Причина)</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Выберите причину" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {REASONS.map((r) => (
                                                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="nextPurchaseFormat"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Интерес (Вторичка/Новостройка)</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Тип недвижимости" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {PURCHASE_FORMATS.map((p) => (
                                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="purchaseBudget"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Бюджет покупки (₸)</FormLabel>
                                                    <FormControl>
                                                        <PriceInput
                                                            placeholder="60 000 000"
                                                            value={field.value ?? ""}
                                                            onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="source"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Источник</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Источник контакта" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {SOURCES.map((s) => (
                                                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="managerComment"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Комментарий</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Заметки..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {form.watch("nextPurchaseFormat") === "NEW_BUILDING" && (
                                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <FormField
                                                control={form.control}
                                                name="projectId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="flex items-center gap-2">
                                                            <Home className="h-4 w-4 text-orange-600" />
                                                            Выберите ЖК (Шахматка)
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-white">
                                                                    <SelectValue placeholder={isLoadingProjects ? "Загрузка проектов..." : "Выберите проект для привязки"} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {projects.map((p: any) => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.city})</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormDescription>
                                                            Сделка будет связана с выбранным жилым комплексом.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* EDIT MODE: Full Accordion Form */}
                            {isEditMode && (
                                <Accordion
                                    type="multiple"
                                    value={expandedSections}
                                    onValueChange={setExpandedSections}
                                    className="space-y-3"
                                >
                                    {/* 1. Основная информация */}
                                    <AccordionItem value="basic" className="border rounded-lg px-4">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-3">
                                                <User className="h-5 w-5 text-primary" />
                                                <span className="font-medium">Основная информация о продавце</span>
                                                {progress.sections.basic && (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-4 pb-2">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Контактные данные и базовая идентификация клиента.
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Как к вам обращаться?</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Имя" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="lastName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Фамилия</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Фамилия" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <FormField
                                                    control={form.control}
                                                    name="phone"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Телефон</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="+7 (700) 000-00-00"
                                                                    {...field}
                                                                    maxLength={18}
                                                                    onChange={(e) => {
                                                                        let val = e.target.value.replace(/\D/g, '');
                                                                        if (val.startsWith('7')) val = val.substring(1);

                                                                        let formatted = '+7';
                                                                        if (val.length > 0) formatted += ' (' + val.substring(0, 3);
                                                                        if (val.length >= 4) formatted += ') ' + val.substring(3, 6);
                                                                        if (val.length >= 7) formatted += '-' + val.substring(6, 8);
                                                                        if (val.length >= 9) formatted += '-' + val.substring(8, 10);

                                                                        field.onChange(formatted);
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="city"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Город проживания</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Астана" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <FormField
                                                    control={form.control}
                                                    name="source"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Источник контакта</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Выберите источник" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {SOURCES.map((s) => (
                                                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <FormField
                                                control={form.control}
                                                name="managerComment"
                                                render={({ field }) => (
                                                    <FormItem className="mt-4">
                                                        <FormLabel>Комментарий для команды Casa (необязательно)</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Заметки, особенности клиента..."
                                                                className="resize-none"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 2. Причина продажи и срочность */}
                                    <AccordionItem value="reason" className="border rounded-lg px-4">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-3">
                                                <Clock className="h-5 w-5 text-orange-500" />
                                                <span className="font-medium">Причина продажи и срочность</span>
                                                {progress.sections.reason && (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-4 pb-2">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Причина и сроки напрямую влияют на стратегию и цену.
                                                <br />
                                                <span className="text-xs">Casa использует эти данные при выборе формата продажи.</span>
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="reason"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Причина продажи</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Выберите причину" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {REASONS.map((r) => (
                                                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="deadline"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Срочность</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Выберите срок" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {DEADLINES.map((d) => (
                                                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {reason === "OTHER" && (
                                                <FormField
                                                    control={form.control}
                                                    name="reasonOther"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-4">
                                                            <FormLabel>Уточните причину</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Опишите причину..." {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 3. Ценовые ожидания */}
                                    <AccordionItem value="price" className="border rounded-lg px-4">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-3">
                                                <DollarSign className="h-5 w-5 text-green-500" />
                                                <span className="font-medium">Ценовые ожидания</span>
                                                {progress.sections.price && (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-4 pb-2">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Понимание ценовых ожиданий помогает выстроить правильную стратегию.
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="expectedPrice"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Желаемая цена (₸)</FormLabel>
                                                            <FormControl>
                                                                <PriceInput
                                                                    placeholder="50 000 000"
                                                                    value={field.value ?? ""}
                                                                    onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="minPrice"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Минимальная цена (₸)</FormLabel>
                                                            <FormControl>
                                                                <PriceInput
                                                                    placeholder="45 000 000"
                                                                    value={field.value ?? ""}
                                                                    onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                                                />
                                                            </FormControl>
                                                            <FormDescription>Ниже которой не готов опускаться</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <FormField
                                                    control={form.control}
                                                    name="readyToNegotiate"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                                            <div className="space-y-0.5">
                                                                <FormLabel>Готов обсуждать цену</FormLabel>
                                                                <FormDescription>Клиент открыт к торгу</FormDescription>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="marketAssessment"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Оценка рынка продавцом</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Как оценивает цены?" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {MARKET_ASSESSMENTS.map((m) => (
                                                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 4. Планы и финансы */}
                                    <AccordionItem value="plans" className="border rounded-lg px-4">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-3">
                                                <Home className="h-5 w-5 text-blue-500" />
                                                <span className="font-medium">Планы и Финансы</span>
                                                {progress.sections.plans && (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-4 pb-2">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Понимание финансовой ситуации помогает подобрать оптимальную стратегию.
                                            </p>

                                            <FormField
                                                control={form.control}
                                                name="plansToPurchase"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center justify-between rounded-lg border p-3 mb-4">
                                                        <div className="space-y-0.5">
                                                            <FormLabel>Планирует покупку взамен?</FormLabel>
                                                            <FormDescription>Клиент хочет купить другую недвижимость</FormDescription>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            {plansToPurchase && (
                                                <div className="grid grid-cols-2 gap-4 mb-4 pl-4 border-l-2 border-primary/20">
                                                    <FormField
                                                        control={form.control}
                                                        name="nextPurchaseFormat"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Формат покупки</FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Что планирует купить?" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {PURCHASE_FORMATS.map((p) => (
                                                                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="purchaseBudget"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Бюджет на покупку (₸)</FormLabel>
                                                                <FormControl>
                                                                    <PriceInput
                                                                        placeholder="60 000 000"
                                                                        value={field.value ?? ""}
                                                                        onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            <FormField
                                                control={form.control}
                                                name="hasDebts"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center justify-between rounded-lg border p-3 mt-4">
                                                        <div className="space-y-0.5">
                                                            <FormLabel>Есть кредитные обязательства?</FormLabel>
                                                            <FormDescription>Текущие кредиты, ипотека</FormDescription>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            {hasDebts && (
                                                <div className="mt-4 pl-4 border-l-2 border-primary/20">
                                                    <FormField
                                                        control={form.control}
                                                        name="loanPaymentAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Ежемесячный платеж (₸)</FormLabel>
                                                                <FormControl>
                                                                    <PriceInput
                                                                        placeholder="150 000"
                                                                        value={field.value ?? ""}
                                                                        onChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 5. Коммуникация */}
                                    <AccordionItem value="communication" className="border rounded-lg px-4">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-3">
                                                <MessageSquare className="h-5 w-5 text-purple-500" />
                                                <span className="font-medium">Коммуникация</span>
                                                {progress.sections.communication && (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-4 pb-2">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Как и когда лучше связываться с клиентом.
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="communicationChannel"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Предпочтительный канал связи</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Выберите канал" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {COMMUNICATION_CHANNELS.map((c) => (
                                                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="preferredTime"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Удобное время для связи</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Утром до 10:00" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            )}
                        </form>
                    </Form>
                </div>

                {/* Fixed Footer */}
                <div className="p-4 bg-white border-t shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <Button type="submit" form="create-seller-form" className="w-full" disabled={mutation.isPending}>
                        {mutation.isPending
                            ? "Сохранение..."
                            : (isEditMode ? "Сохранить информацию о продавце" : "Создать продавца")
                        }
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Progress calculation helper
function calculateProgress(values: Partial<CreateSellerValues>) {
    const sections = {
        basic: Boolean(values.firstName && values.lastName && values.phone && values.phone.length > 3),
        reason: Boolean(values.reason || values.deadline),
        price: Boolean(values.expectedPrice || values.minPrice),
        plans: Boolean(values.plansToPurchase || values.hasDebts),
        communication: Boolean(values.communicationChannel || values.preferredTime),
    };

    const completed = Object.values(sections).filter(Boolean).length;

    return {
        sections,
        completed,
        total: 5,
    };
}
