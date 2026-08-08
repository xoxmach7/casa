"use client";

import { useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { CreateDealValues, createDealSchema } from "@/lib/schemas";
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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Home } from "lucide-react";
import { PriceInput } from "@/components/ui/price-input";

interface CreateDealFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
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

const PURCHASE_FORMATS = [
    { value: "NEW_BUILDING", label: "Новостройка" },
    { value: "SECONDARY", label: "Вторичка" },
    { value: "HOUSE", label: "Дом" },
    { value: "NOT_DECIDED", label: "Не определился" },
];

const SOURCES = [
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "REFERRAL", label: "Рекомендация" },
    { value: "WEBSITE", label: "Сайт" },
    { value: "OTHER", label: "Другое" },
];

// Same defaults CreatePropertyForm's full accordion sends today — the
// backend's create-time validation (CrmPropertyMinimalSchema) only keeps the
// fields surfaced below, but sending the rest keeps this call shaped exactly
// like every other property-creation request in the app.
const PROPERTY_DEFAULTS = {
    propertyType: "APARTMENT" as const,
    buildingType: "MONOLITH",
    ceilingHeight: 2.7,
    bathroomType: "SOVMESTNYI",
    repairState: "COSMETIC",
    actualCondition: "GOOD",
    isMortgaged: false,
    encumbranceType: "NONE",
    hasPanoramicWindows: false,
    hasFloorHeating: false,
    hasClosedTerritory: false,
    hasWalkInCloset: false,
    hasAirConditioning: false,
    hasBuiltInAppliances: false,
    furnitureLevel: "NONE",
    appliancesLevel: "NONE",
    documentsVerified: false,
};

export function CreateDealForm({ open, onOpenChange, onSuccess, activeFunnelId }: CreateDealFormProps) {
    const queryClient = useQueryClient();

    const form = useForm<CreateDealValues>({
        resolver: zodResolver(createDealSchema) as any,
        defaultValues: {
            firstName: "",
            lastName: "",
            phone: "+7",
            source: "",
            managerComment: "",
            nextPurchaseFormat: undefined,
            purchaseBudget: undefined,
            projectId: "",
            residentialComplex: "",
            district: "",
            address: "г. Астана, ",
            rooms: 1,
            area: undefined,
            floor: 1,
            totalFloors: 9,
            yearBuilt: 2020,
            price: undefined,
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

    const nextPurchaseFormat = useWatch({ control: form.control, name: "nextPurchaseFormat" });
    const reason = useWatch({ control: form.control, name: "reason" });

    const mutation = useMutation({
        mutationFn: async (data: CreateDealValues) => {
            const sellerRes = await api.post("/sellers", {
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                source: data.source || undefined,
                managerComment: data.managerComment || undefined,
                reason: data.reason,
                reasonOther: data.reasonOther,
                nextPurchaseFormat: data.nextPurchaseFormat,
                purchaseBudget: data.purchaseBudget,
                projectId: data.projectId || undefined,
                funnelId: activeFunnelId || undefined,
            });
            const sellerId = sellerRes.data.id as string;

            try {
                await api.post("/crm-properties", {
                    ...PROPERTY_DEFAULTS,
                    sellerId,
                    residentialComplex: data.residentialComplex,
                    district: data.district,
                    address: data.address || undefined,
                    rooms: data.rooms,
                    area: data.area,
                    floor: data.floor,
                    totalFloors: data.totalFloors,
                    yearBuilt: data.yearBuilt,
                    price: data.price,
                });
            } catch (propertyError) {
                const err: any = new Error("PROPERTY_CREATE_FAILED");
                err.sellerCreated = true;
                throw err;
            }
        },
        onSuccess: () => {
            toast.success("Сделка создана");
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            queryClient.invalidateQueries({ queryKey: ["properties"] });
            onOpenChange(false);
            form.reset();
            if (onSuccess) onSuccess();
        },
        onError: (error: any) => {
            if (error.sellerCreated) {
                toast.error("Клиент сохранён, но объект — нет. Добавьте его вручную из карточки сделки.", { duration: 8000 });
                queryClient.invalidateQueries({ queryKey: ["sellers"] });
                onOpenChange(false);
                form.reset();
                return;
            }

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
        const missingFields = Object.keys(errors).map((field) => errors[field]?.message || field);
        toast.error(`Исправьте ошибки (${missingFields.length}):`, {
            description: missingFields.join(", "),
            duration: 6000,
        });
    }

    function onSubmit(data: CreateDealValues) {
        mutation.mutate(data);
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-3xl bg-gray-50 p-0 gap-0 overflow-hidden">
                <div className="p-6 bg-white border-b shrink-0 z-20 shadow-sm">
                    <SheetHeader>
                        <SheetTitle>Новая сделка</SheetTitle>
                        <SheetDescription>
                            Клиент и объект, который он продаёт, — одной формой.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scroll-smooth min-h-0">
                    <Form {...form}>
                        <form id="create-deal-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8 pb-6">

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <User className="h-4 w-4 text-primary" />
                                    Клиент
                                </div>

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

                                {reason === "OTHER" && (
                                    <FormField
                                        control={form.control}
                                        name="reasonOther"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Уточните причину</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Опишите причину..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

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

                                {nextPurchaseFormat === "NEW_BUILDING" && (
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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}

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
                            </div>

                            <div className="space-y-4 border-t pt-6">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Home className="h-4 w-4 text-primary" />
                                    Объект продажи
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="residentialComplex"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>Жилой комплекс / дом</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Название ЖК" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="district"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Район</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Есильский..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="rooms"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Комнатность</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="area"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Площадь (м²)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Цена (₸)</FormLabel>
                                                <FormControl>
                                                    <PriceInput value={field.value ?? ""} onChange={(v) => field.onChange(v ? Number(v) : undefined)} className="font-bold" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="floor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Этаж</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="totalFloors"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Всего этажей</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="yearBuilt"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Год постройки</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>Точный адрес</FormLabel>
                                                <FormControl>
                                                    <Input {...field} value={field.value ?? ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Ремонт, залог, фото и документы добавляются позже — из карточки объекта.
                                </p>
                            </div>
                        </form>
                    </Form>
                </div>

                <div className="p-4 bg-white border-t shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <Button type="submit" form="create-deal-form" className="w-full" disabled={mutation.isPending}>
                        {mutation.isPending ? "Сохранение..." : "Создать сделку"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
