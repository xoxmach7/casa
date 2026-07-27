"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import api from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCheck, Trophy, PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";
import { PriceInput } from "@/components/ui/price-input";
import { useState } from "react";

const CloseDealSchema = z.object({
    offerId: z.string().min(1, "Выберите оффер"),
    finalPrice: z.coerce.number().min(1, "Укажите финальную цену"),
    commission: z.coerce.number().min(0, "Комиссия"),
    notes: z.string().optional()
});

type CloseDealInput = z.infer<typeof CloseDealSchema>;

interface CloseDealDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    propertyId: string;
    onSuccess: () => void;
}

interface DealResult {
    finalPrice: number;
    commission: number;
    buyerName: string;
}

export function CloseDealDialog({ open, onOpenChange, propertyId, onSuccess }: CloseDealDialogProps) {
    const queryClient = useQueryClient();
    const [dealResult, setDealResult] = useState<DealResult | null>(null);

    const form = useForm<CloseDealInput>({
        // @ts-ignore
        resolver: zodResolver(CloseDealSchema),
    });

    // Fetch offers for this property
    const { data: offers } = useQuery({
        queryKey: ["offers", propertyId],
        queryFn: async () => {
            const res = await api.get(`/buyers/offers/${propertyId}`);
            return res.data;
        },
        enabled: open && !dealResult
    });

    const mutation = useMutation({
        mutationFn: (data: CloseDealInput) => {
            return api.post(`/crm-properties/${propertyId}/close`, {
                offerId: data.offerId,
                finalPrice: data.finalPrice,
                commission: data.commission,
                notes: data.notes
            });
        },
        onSuccess: (_, variables) => {
            // Trigger Confetti
            const duration = 3 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval: any = setInterval(function () {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

            // Find buyer name from offers
            const offer = offers?.find((o: any) => o.id === variables.offerId);
            const buyerName = offer ? `${offer.buyer.firstName} ${offer.buyer.lastName}` : "Покупатель";

            // Show result screen
            setDealResult({
                finalPrice: variables.finalPrice,
                commission: variables.commission,
                buyerName
            });

            queryClient.invalidateQueries({ queryKey: ["properties"] });
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
        },
        onError: (err: any) => toast.error(err.response?.data?.error || "Ошибка закрытия сделки")
    });

    // Auto-fill price when offer selected
    const handleOfferChange = (offerId: string) => {
        form.setValue("offerId", offerId);
        const offer = offers?.find((o: any) => o.id === offerId);
        if (offer) {
            form.setValue("finalPrice", offer.price);
            // Auto calc commission (e.g. 2% default)
            form.setValue("commission", Math.round(offer.price * 0.02));
        }
    };

    const handleClose = () => {
        setDealResult(null);
        form.reset();
        onOpenChange(false);
        onSuccess();
    };

    // SUCCESS SCREEN
    if (dealResult) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-md text-center">
                    <div className="py-8">
                        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <Trophy className="w-10 h-10 text-green-600" />
                        </div>

                        <DialogTitle className="text-2xl font-bold text-green-700 mb-2 flex items-center justify-center gap-2">
                            <PartyPopper className="w-6 h-6" />
                            Сделка закрыта!
                            <PartyPopper className="w-6 h-6" />
                        </DialogTitle>

                        <p className="text-muted-foreground mb-6">
                            Поздравляем с успешной продажей!
                        </p>

                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-green-600 mb-1">Покупатель</div>
                                    <div className="font-semibold text-green-800">{dealResult.buyerName}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-green-600 mb-1">Итоговая цена</div>
                                    <div className="font-bold text-lg text-green-800">
                                        {dealResult.finalPrice.toLocaleString('ru-RU')} ₸
                                    </div>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-green-200">
                                    <div className="text-xs text-green-600 mb-1">Ваша комиссия</div>
                                    <div className="font-bold text-xl text-green-700">
                                        {dealResult.commission.toLocaleString('ru-RU')} ₸
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleClose}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                            Отлично! Закрыть
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // FORM SCREEN
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-700">
                        <CheckCheck className="w-6 h-6" />
                        Закрытие сделки
                    </DialogTitle>
                    <DialogDescription>
                        Выберите принятый оффер и подтвердите финальные условия.
                    </DialogDescription>
                </DialogHeader>

                {/* @ts-ignore */}
                <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Принятый оффер</Label>
                        <Select onValueChange={handleOfferChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите оффер" />
                            </SelectTrigger>
                            <SelectContent>
                                {offers?.map((o: any) => (
                                    <SelectItem key={o.id} value={o.id}>
                                        {o.price.toLocaleString()} ₸ - {o.buyer.firstName} {o.buyer.lastName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.offerId && <p className="text-red-500 text-xs">Выберите оффер</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Финальная цена</Label>
                            <Controller name="finalPrice" control={form.control} render={({ field }) => (
                              <PriceInput value={field.value ?? ""} onChange={field.onChange} placeholder="0" />
                            )} />
                        </div>
                        <div className="space-y-2">
                            <Label>Комиссия (₸)</Label>
                            <Controller name="commission" control={form.control} render={({ field }) => (
                              <PriceInput value={field.value ?? ""} onChange={field.onChange} placeholder="0" />
                            )} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Комментарий</Label>
                        <Input {...form.register("notes")} placeholder="Дополнительные детали..." />
                    </div>

                    <DialogFooter>
                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={mutation.isPending}>
                            {mutation.isPending ? "Закрытие..." : "Закрыть сделку"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

