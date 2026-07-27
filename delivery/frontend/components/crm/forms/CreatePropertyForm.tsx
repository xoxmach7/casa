"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreatePropertyValues, createPropertySchema } from "@/lib/schemas";
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
    FormDescription,
} from "@/components/ui/form";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { FileUploader } from "@/components/ui/FileUploader";
import { PriceInput } from "@/components/ui/price-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Building2,
    Home,
    Hammer, // Construction/Renovation
    Banknote, // Mortgage/Pledge
    Sofa, // Furniture/Comfort
    Share2, // Social Media
    FileText, // Docs
    CheckCircle2,
    Sparkles,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyLoader } from "@/components/ui/StrategyLoader";

interface CreatePropertyFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sellerId?: string; // Made optional for edit mode
    initialData?: CreatePropertyValues & { id: string }; // Add initialData
}

const PROPERTY_TYPES = [
    { value: "BRICK", label: "Кирпичный" },
    { value: "MONOLITH", label: "Монолитный" },
    { value: "PANEL", label: "Панельный" },
    { value: "BLOCK", label: "Блочный" },
    { value: "MONOLITH_BRICK", label: "Монолит-Кирпич" },
];

const REPAIR_STATES = [
    { value: "NONE", label: "Черновая / Без ремонта" },
    { value: "COSMETIC", label: "Косметический" },
    { value: "EURO", label: "Евроремонт" },
    { value: "DESIGNER", label: "Дизайнерский" },
    { value: "CAPITAL", label: "Требует ремонта" },
];

export function CreatePropertyForm({ open, onOpenChange, sellerId, initialData }: CreatePropertyFormProps) {
    const queryClient = useQueryClient();
    const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
    const [activeSections, setActiveSections] = useState<string[]>(["basic", "building", "repair", "pledge", "options", "media", "docs"]);

    // Determine effective property ID (edited or newly created)
    const effectivePropertyId = initialData?.id || createdPropertyId;

    // Reset state when opening/closing
    useEffect(() => {
        if (!open) {
            setCreatedPropertyId(null);
            // Form reset is handled below
        }
    }, [open]);

    const form = useForm<CreatePropertyValues>({
        resolver: zodResolver(createPropertySchema) as any,
        defaultValues: {
            // 1. Basic
            residentialComplex: "",
            district: "",
            address: "г. Астана, ",
            price: 0,
            area: 0,
            floor: 1,
            totalFloors: 9,
            rooms: 1,
            yearBuilt: 2020,
            elevatorCount: 1,

            // 2. Building
            buildingType: "MONOLITH",
            ceilingHeight: 2.7,
            bathroomType: "SOVMESTNYI",

            // 3. Repair
            repairState: "COSMETIC",
            actualCondition: "GOOD",

            // 4. Mortgage
            isMortgaged: false,
            encumbranceType: "NONE",

            // 5. Options
            hasPanoramicWindows: false,
            hasFloorHeating: false,
            hasClosedTerritory: false,
            hasWalkInCloset: false,
            hasAirConditioning: false,
            hasBuiltInAppliances: false,
            furnitureLevel: "NONE",
            appliancesLevel: "NONE",

            // 7. Docs
            documentsVerified: false,
            sellerId: sellerId || "",
        },
    });

    // Real-time progress calculation
    const values = useWatch({ control: form.control });

    // AI Animation State
    const [isThinking, setIsThinking] = useState(false);

    // Reset or Populate when opened
    useEffect(() => {
        if (!open) {
            form.reset();
            return;
        }

        if (initialData) {
            // Populate form with existing data
            form.reset(initialData);
        } else if (sellerId) {
            // Prepare for new creation
            form.reset({
                ...form.getValues(), // keep defaults
                sellerId: sellerId,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, sellerId, initialData]);

    // Calculate progress (Approximate) derived
    const filled = [
        values.residentialComplex,
        values.district,
        values.price,
        values.area,
        values.rooms,
        values.yearBuilt,
        values.address,
    ].filter(Boolean).length;

    const progress = Math.min(Math.round((filled / 10) * 100), 100);

    const createMutation = useMutation({
        mutationFn: async (data: CreatePropertyValues) => {
            return api.post("/crm-properties", data);
        },
        onSuccess: (data: any) => {
            toast.success("Объект успешно создан! Теперь можно загрузить фото и документы.");
            queryClient.invalidateQueries({ queryKey: ["properties"] });
            if (data?.id) {
                setCreatedPropertyId(data.id);
                setActiveSections(["media", "docs"]);
                setTimeout(() => {
                    const mediaSection = document.getElementById("accordion-item-media");
                    mediaSection?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
            } else {
                onOpenChange(false);
                form.reset();
            }
        },
        onError: (error: any) => {
            console.error(error);
            toast.error(error.response?.data?.message || "Ошибка создания объекта");
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: CreatePropertyValues) => {
            if (!initialData?.id) throw new Error("No ID for update");
            return api.put(`/crm-properties/${initialData.id}`, data);
        },
        onSuccess: () => {
            toast.success("Объект успешно обновлен!");
            queryClient.invalidateQueries({ queryKey: ["properties"] });
            onOpenChange(false);
        },
        onError: (error: any) => {
            console.error(error);
            toast.error(error.response?.data?.message || "Ошибка обновления объекта");
        },
    });

    const onSubmit = async (data: CreatePropertyValues) => {
        if (!data.sellerId && sellerId) data.sellerId = sellerId;

        setIsThinking(true);
        try {
            // Artificial delay for "Magic" (1s) to show spinner
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (initialData?.id) {
                await updateMutation.mutateAsync(data);
            } else {
                await createMutation.mutateAsync(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsThinking(false);
        }
    };

    // Conditional Logic watchers
    const isMortgaged = form.watch("isMortgaged");

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-4xl bg-gray-50 p-0 gap-0 overflow-hidden z-[100]">
                {/* AI Thinking Overlay */}
                {isThinking && <StrategyLoader />}

                <div className="p-6 bg-white border-b shrink-0 z-20 shadow-sm">
                    <SheetHeader>
                        <SheetTitle className="text-xl flex items-center justify-between">
                            Новый Объект
                            <span className="text-sm font-normal text-muted-foreground bg-gray-100 px-3 py-1 rounded-full">
                                {progress}% заполнено
                            </span>
                        </SheetTitle>
                        <SheetDescription>
                            Заполните подробную карточку для точной оценки ликвидности.
                        </SheetDescription>
                    </SheetHeader>
                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-gray-100 mt-4 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scroll-smooth min-h-0">
                    <Form {...form}>
                        <form id="create-property-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">

                            <Accordion
                                type="multiple"
                                value={activeSections}
                                onValueChange={setActiveSections}
                                className="w-full space-y-4"
                            >

                                {/* 1. ОСНОВНЫЕ ХАРАКТЕРИСТИКИ */}
                                <AccordionItem value="basic" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-indigo-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                <Home className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Основные характеристики</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">ЖК, Район, Площадь, Этаж</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="residentialComplex"
                                                render={({ field }) => (
                                                    <FormItem className="col-span-2">
                                                        <FormLabel>Жилой Комплекс</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Название ЖК" {...field} value={field.value ?? ""} />
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
                                                            <Input placeholder="Район (Есильский...)" {...field} value={field.value ?? ""} />
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
                                                            <Input type="number" {...field} value={field.value ?? ""} />
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
                                                        <FormLabel>Цена (KZT)</FormLabel>
                                                        <FormControl>
                                                            <PriceInput value={field.value ?? ""} onChange={field.onChange} className="font-bold" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1">
                                                <FormField
                                                    control={form.control}
                                                    name="floor"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Этаж</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="totalFloors"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Всего</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
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
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 2. ДОМ И ПАРАМЕТРЫ */}
                                <AccordionItem value="building" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-blue-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Дом и параметры</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">Тип дома, Потолки, Санузел</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="buildingType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Тип дома</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="z-[110]">
                                                                {PROPERTY_TYPES.map(t => (
                                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="elevatorCount"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Лифты (шт)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} value={field.value ?? ""} />
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
                                                            <Input type="number" {...field} value={field.value ?? ""} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="ceilingHeight"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Потолки (м)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="kitchenArea"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Кухня (м²)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 3. РЕМОНТ И СОСТОЯНИЕ */}
                                <AccordionItem value="repair" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-orange-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                                <Hammer className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Ремонт и состояние</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">Влияет на ликвидность</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="repairState"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Уровень ремонта</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="z-[110]">
                                                            {REPAIR_STATES.map(r => (
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
                                            name="actualCondition"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Фактическое состояние</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="z-[110]">
                                                            <SelectItem value="EXCELLENT">Отличное (заезжай и живи)</SelectItem>
                                                            <SelectItem value="GOOD">Хорошее (можно освежить)</SelectItem>
                                                            <SelectItem value="NEEDS_INVESTMENT">Требует вложений</SelectItem>
                                                            <SelectItem value="CRITICAL">Убитое состояние</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 4. ЗАЛОГ И ОБРЕМЕНЕНИЯ */}
                                <AccordionItem value="pledge" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-red-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-red-50 rounded-lg text-red-600">
                                                <Banknote className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Залог и обременения</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">Юридическая чистота</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="isMortgaged"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">Квартира в залоге?</FormLabel>
                                                        <FormDescription>
                                                            Включите, если есть обременение банка
                                                        </FormDescription>
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
                                        {isMortgaged && (
                                            <div className="grid grid-cols-2 gap-4 p-4 bg-red-50 rounded-lg animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="mortgageBank"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Банк залогодержатель</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Например: Отбасы Банк" {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="mortgageRemaining"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Остаток долга (KZT)</FormLabel>
                                                            <FormControl>
                                                                <PriceInput value={field.value ?? ""} onChange={field.onChange} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="mortgageRemovalMethod"
                                                    render={({ field }) => (
                                                        <FormItem className="col-span-2">
                                                            <FormLabel>Как планируете снимать залог?</FormLabel>
                                                            <FormControl>
                                                                <Textarea placeholder="Например: Погашение за счет задатка покупателя" {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 5. ОПЦИИ И УДОБСТВА */}
                                <AccordionItem value="options" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-emerald-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                                <Sofa className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Опции и комфорт</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">Мебель, техника, удобства</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-4">
                                        {/* Мебель и Техника */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="furnitureLevel"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Мебель</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="z-[110]">
                                                                <SelectItem value="NONE">Без мебели</SelectItem>
                                                                <SelectItem value="PARTIAL">Частично</SelectItem>
                                                                <SelectItem value="FULL">Полностью</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="appliancesLevel"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Техника</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="z-[110]">
                                                                <SelectItem value="NONE">Без техники</SelectItem>
                                                                <SelectItem value="PARTIAL">Частично</SelectItem>
                                                                <SelectItem value="FULL">Полностью</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Switches List */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                            {[
                                                { name: "hasPanoramicWindows", label: "Панорамные окна" },
                                                { name: "hasFloorHeating", label: "Теплый пол" },
                                                { name: "hasClosedTerritory", label: "Закрытый двор" },
                                                { name: "hasWalkInCloset", label: "Гардеробная" },
                                                { name: "hasAirConditioning", label: "Кондиционер" },
                                                { name: "hasBuiltInAppliances", label: "Встр. техника" },
                                            ].map((option) => (
                                                <FormField
                                                    key={option.name}
                                                    control={form.control}
                                                    name={option.name as any}
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-gray-50 transition-colors">
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1 leading-none">
                                                                <FormLabel className="cursor-pointer">
                                                                    {option.label}
                                                                </FormLabel>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 6. ПУБЛИКАЦИИ И МЕДИА */}
                                <AccordionItem value="media" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-purple-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                                <Share2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Медиа и Публикации</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">Фото и ссылки</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-6">
                                        {/* Image Uploader */}
                                        <div className="space-y-2">
                                            <FormLabel className="text-base font-semibold">Фотографии объекта</FormLabel>
                                            {effectivePropertyId ? (
                                                <ImageUploader propertyId={effectivePropertyId} />
                                            ) : (
                                                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground bg-gray-50">
                                                    <p className="text-sm">Загрузка фото станет доступна после создания объекта</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t pt-4">
                                            <FormLabel className="text-base font-semibold mb-3 block">Ссылки на объявления</FormLabel>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="krishaUrl"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Krisha.kz</FormLabel>
                                                            <Input placeholder="Ссылка..." {...field} value={field.value ?? ""} />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="knUrl"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Kn.kz</FormLabel>
                                                            <Input placeholder="Ссылка..." {...field} value={field.value ?? ""} />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="instagramUrl"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Instagram</FormLabel>
                                                            <Input placeholder="Ссылка..." {...field} value={field.value ?? ""} />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="tikTokUrl"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>TikTok</FormLabel>
                                                            <Input placeholder="Ссылка..." {...field} value={field.value ?? ""} />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 7. ДОКУМЕНТЫ */}
                                <AccordionItem value="docs" className="bg-white border rounded-lg px-4 shadow-sm border-l-4 border-l-gray-500">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900">Документы</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">Медиа и файлы</div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-6 space-y-4">
                                        <div className="space-y-4">
                                            {effectivePropertyId ? (
                                                <FileUploader propertyId={effectivePropertyId} />
                                            ) : (
                                                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground bg-gray-50">
                                                    <p className="text-sm">Загрузка документов будет доступна после создания объекта</p>
                                                </div>
                                            )}
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="documentsVerified"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-green-50/50">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base text-green-700">Документы проверены?</FormLabel>
                                                        <FormDescription className="text-green-600/80">
                                                            Подтверждение юридической чистоты
                                                        </FormDescription>
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
                                    </AccordionContent>
                                </AccordionItem>



                            </Accordion>
                        </form>
                    </Form>
                </div>

                {/* Fixed Footer */}
                <div className="p-4 bg-white border-t shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        form="create-property-form"
                        className="bg-indigo-600 hover:bg-indigo-700 min-w-[200px]"
                        disabled={createMutation.isPending || updateMutation.isPending || isThinking}
                    >
                        {createMutation.isPending || updateMutation.isPending || isThinking ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {initialData ? "Сохранение..." : "Анализ..."}
                            </>
                        ) : effectivePropertyId ? (
                            <>
                                {initialData ? "Сохранить изменения" : "Сохранено"}
                                <CheckCircle2 className="ml-2 h-4 w-4" />
                            </>
                        ) : (
                            <>
                                Создать объект
                                <CheckCircle2 className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            </SheetContent>
        </Sheet >
    );
}
