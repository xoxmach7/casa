
import { z } from "zod";
import { useForm, Resolver, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PriceInput } from "@/components/ui/price-input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// --- SCHEMAS ---

const CreateBuyerSchema = z.object({
    firstName: z.string().min(2, "Минимум 2 символа"),
    lastName: z.string().optional(),
    phone: z.string().min(10, "Некорректный телефон"),
    minBudget: z.coerce.number().optional(),
    maxBudget: z.coerce.number().optional(),
    notes: z.string().optional(),
});

type CreateBuyerInput = z.infer<typeof CreateBuyerSchema>;

const CreateShowSchema = z.object({
    buyerId: z.string().min(1, "Выберите покупателя"),
    date: z.string().min(1, "Выберите дату"),
    time: z.string().min(1, "Выберите время"),
    notes: z.string().optional(),
});

type CreateShowInput = z.infer<typeof CreateShowSchema>;

const FeedbackSchema = z.object({
    feedback: z.string().min(5, "Минимум 5 символов"),
    sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
    rating: z.coerce.number().min(1).max(5).optional(),
});

type FeedbackInput = z.infer<typeof FeedbackSchema>;

const CreateOfferSchema = z.object({
    buyerId: z.string().min(1, "Выберите покупателя"),
    price: z.coerce.number().min(1, "Укажите цену"),
    comment: z.string().optional()
});

type CreateOfferInput = z.infer<typeof CreateOfferSchema>;


// --- COMPONENTS ---

export function CreateBuyerDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
    const queryClient = useQueryClient();
    const form = useForm<CreateBuyerInput>({
        resolver: zodResolver(CreateBuyerSchema) as any,
    });

    const mutation = useMutation({
        mutationFn: (data: CreateBuyerInput) => api.post("/buyers", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["buyers"] }); // Need to ensure we fetch buyers list
            toast.success("Покупатель создан");
            onOpenChange(false);
            form.reset();
        },
        onError: () => toast.error("Ошибка создания")
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Новый покупатель</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Имя</Label>
                            <Input {...form.register("firstName")} />
                            {form.formState.errors.firstName && <p className="text-red-500 text-xs">{form.formState.errors.firstName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Фамилия</Label>
                            <Input {...form.register("lastName")} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Телефон</Label>
                        <Input {...form.register("phone")} placeholder="+7" />
                        {form.formState.errors.phone && <p className="text-red-500 text-xs">{form.formState.errors.phone.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Бюджет от</Label>
                            <Controller name="minBudget" control={form.control} render={({ field }) => (
                              <PriceInput value={field.value ?? ""} onChange={field.onChange} placeholder="0" />
                            )} />
                        </div>
                        <div className="space-y-2">
                            <Label>Бюджет до</Label>
                            <Controller name="maxBudget" control={form.control} render={({ field }) => (
                              <PriceInput value={field.value ?? ""} onChange={field.onChange} placeholder="0" />
                            )} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Заметки (предпочтения)</Label>
                        <Textarea {...form.register("notes")} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? "Сохранение..." : "Создать"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function CreateShowDialog({ open, onOpenChange, propertyId }: { open: boolean, onOpenChange: (o: boolean) => void, propertyId: string }) {
    const queryClient = useQueryClient();
    const form = useForm<CreateShowInput>({
        resolver: zodResolver(CreateShowSchema) as any,
    });

    // Fetch Buyers for selection
    // We actually need a simple buyers list for dropdown.
    // The current GET /api/buyers supports search, paging.
    // Let's assume we fetch first 50.

    const { data: buyersList } = useQuery({
        queryKey: ["buyers-list"],
        queryFn: async () => {
            const res = await api.get("/buyers?limit=100");
            return res.data.sellers || res.data; // Check response structure
        },
        enabled: open
    });

    const mutation = useMutation({
        mutationFn: (data: CreateShowInput) => {
            const dateTime = new Date(`${data.date}T${data.time}`);
            return api.post("/buyers/shows", {
                propertyId,
                buyerId: data.buyerId,
                date: dateTime.toISOString(),
                status: 'SCHEDULED',
                notes: data.notes
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shows", propertyId] });
            queryClient.invalidateQueries({ queryKey: ["properties"] }); // Update counters
            toast.success("Показ запланирован");
            onOpenChange(false);
            form.reset();
        },
        onError: () => toast.error("Ошибка")
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Запланировать показ</DialogTitle></DialogHeader>
                <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Покупатель</Label>
                        <Select onValueChange={(val) => form.setValue("buyerId", val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите покупателя" />
                            </SelectTrigger>
                            <SelectContent>
                                {(Array.isArray(buyersList) ? buyersList : (buyersList?.sellers || [])).map((b: any) => (
                                    <SelectItem key={b.id} value={b.id}>{b.firstName} {b.lastName} ({b.phone})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.buyerId && <p className="text-red-500 text-xs">{form.formState.errors.buyerId.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Дата</Label>
                            <Input type="date" {...form.register("date")} />
                            {form.formState.errors.date && <p className="text-red-500 text-xs">{form.formState.errors.date.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Время</Label>
                            <Input type="time" {...form.register("time")} />
                            {form.formState.errors.time && <p className="text-red-500 text-xs">{form.formState.errors.time.message}</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Комментарий</Label>
                        <Textarea {...form.register("notes")} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={mutation.isPending}>Запланировать</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function FeedbackDialog({ open, onOpenChange, showId, propertyId }: { open: boolean, onOpenChange: (o: boolean) => void, showId: string, propertyId: string }) {
    const queryClient = useQueryClient();
    const form = useForm<FeedbackInput>({
        resolver: zodResolver(FeedbackSchema) as any,
        defaultValues: { sentiment: "NEUTRAL" }
    });

    const mutation = useMutation({
        mutationFn: (data: FeedbackInput) => {
            return api.put(`/buyers/shows/${showId}`, {
                feedback: data.feedback,
                feedbackSentiment: data.sentiment,
                status: 'COMPLETED',
                rating: data.rating
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shows", propertyId] });
            queryClient.invalidateQueries({ queryKey: ["properties"] }); // AI updates might happen
            toast.success("Фидбек сохранен");
            onOpenChange(false);
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Фидбек по показу</DialogTitle></DialogHeader>
                <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Впечатление покупателя</Label>
                        <Textarea {...form.register("feedback")} placeholder="Что сказал покупатель?.." />
                        {form.formState.errors.feedback && <p className="text-red-500 text-xs">{form.formState.errors.feedback.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Настроение</Label>
                        <Select onValueChange={(val: any) => form.setValue("sentiment", val)} defaultValue="NEUTRAL">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="POSITIVE">👍 Позитивное (Хочет купить)</SelectItem>
                                <SelectItem value="NEUTRAL">😐 Нейтральное (Думает)</SelectItem>
                                <SelectItem value="NEGATIVE">👎 Негативное (Отказ)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Оценка объекта (1-5)</Label>
                        <Input type="number" min="1" max="5" {...form.register("rating")} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={mutation.isPending}>Сохранить и Анализировать</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function CreateOfferDialog({ open, onOpenChange, propertyId }: { open: boolean, onOpenChange: (o: boolean) => void, propertyId: string }) {
    const queryClient = useQueryClient();
    const form = useForm<CreateOfferInput>({
        resolver: zodResolver(CreateOfferSchema) as any,
    });

    // Reuse buyers list logic or pass buyers
    const { data: buyersList } = useQuery({
        queryKey: ["buyers-list"],
        queryFn: async () => {
            const res = await api.get("/buyers?limit=100");
            return res.data.sellers || res.data;
        },
        enabled: open
    });

    const mutation = useMutation({
        mutationFn: (data: CreateOfferInput) => api.post("/buyers/offers", { ...data, propertyId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["properties"] }); // Update leadsCount/Badge
            queryClient.invalidateQueries({ queryKey: ["offers", propertyId] }); // If we list offers
            toast.success("Оффер зафиксирован! 💰");
            onOpenChange(false);
            form.reset();
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle className="text-green-700">📜 Новый Оффер</DialogTitle></DialogHeader>
                <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Покупатель</Label>
                        <Select onValueChange={(val) => form.setValue("buyerId", val)}>
                            <SelectTrigger><SelectValue placeholder="Кто делает оффер?" /></SelectTrigger>
                            <SelectContent>
                                {(Array.isArray(buyersList) ? buyersList : (buyersList?.sellers || [])).map((b: any) => (
                                    <SelectItem key={b.id} value={b.id}>{b.firstName} {b.lastName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.buyerId && <p className="text-red-500 text-xs">Выберите покупателя</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Сумма предложения (₸)</Label>
                        <Controller name="price" control={form.control} render={({ field }) => (
                          <PriceInput value={field.value ?? ""} onChange={field.onChange} placeholder="0" className="font-bold text-lg" />
                        )} />
                        {form.formState.errors.price && <p className="text-red-500 text-xs">Укажите цену</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Условия / Комментарий</Label>
                        <Textarea {...form.register("comment")} placeholder="Например: Ипотека, первоначальный 50%..." />
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white" disabled={mutation.isPending}>
                            Зафиксировать Оффер
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
