"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MissingDataMode = "INTERVIEW" | "STRATEGY";

interface MissingDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sellerId: string;
    mode: MissingDataMode;
    properties?: any[]; // For STRATEGY mode
    onSuccess: () => void;
}

export function MissingDataDialog({ open, onOpenChange, sellerId, mode, properties, onSuccess }: MissingDataDialogProps) {
    const queryClient = useQueryClient();

    // STRATEGY MODE STATE
    const targetProperty = properties && properties.length > 0 ? properties[0] : null;
    const [repairState, setRepairState] = useState(targetProperty?.repairState || "COSMETIC");
    const [ceilingHeight, setCeilingHeight] = useState(targetProperty?.ceilingHeight || 2.7);

    // INTERVIEW MODE STATE
    const [reason, setReason] = useState("");
    const [deadline, setDeadline] = useState("");

    const mutation = useMutation({
        mutationFn: async () => {
            if (mode === "STRATEGY") {
                if (!targetProperty) throw new Error("Нет объектов недвижимости");
                return api.put(`/crm-properties/${targetProperty.id}`, {
                    repairState,
                    ceilingHeight: Number(ceilingHeight),
                });
            } else {
                // INTERVIEW MODE
                return api.put(`/sellers/${sellerId}/interview`, {
                    reason,
                    deadline,
                });
            }
        },
        onSuccess: () => {
            toast.success("Данные обновлены");
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            onSuccess();
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast.error("Ошибка сохранения данных");
        }
    });

    // Determine title and description based on mode
    const title = mode === "INTERVIEW" ? "Результаты интервью" : "Данные об объекте";
    const description = mode === "INTERVIEW"
        ? "Укажите причину продажи и дедлайн для перехода на этап Интервью."
        : "Для стратегии необходимо заполнить технические параметры.";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {mode === "STRATEGY" && targetProperty && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="repair" className="text-right">Ремонт</Label>
                                <Select value={repairState} onValueChange={setRepairState}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Выберите состояние" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Черновая</SelectItem>
                                        <SelectItem value="COSMETIC">Косметический</SelectItem>
                                        <SelectItem value="EURO">Евроремонт</SelectItem>
                                        <SelectItem value="DESIGNER">Дизайнерский</SelectItem>
                                        <SelectItem value="CAPITAL">Требует кап. ремонта</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="ceiling" className="text-right">Потолки</Label>
                                <Input
                                    id="ceiling"
                                    type="number"
                                    step="0.1"
                                    value={ceilingHeight}
                                    onChange={(e) => setCeilingHeight(e.target.value)}
                                    className="col-span-3"
                                />
                            </div>
                        </>
                    )}

                    {mode === "INTERVIEW" && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="reason" className="text-right">Причина</Label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Причина продажи" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RELOCATION">Переезд</SelectItem>
                                        <SelectItem value="SIZE_CHANGE">Улучшение условий</SelectItem>
                                        <SelectItem value="FINANCIAL_NEED">Финансовая необходимость</SelectItem>
                                        <SelectItem value="INVESTMENT">Инвестиция</SelectItem>
                                        <SelectItem value="OTHER">Другое</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="deadline" className="text-right">Срок</Label>
                                <Select value={deadline} onValueChange={setDeadline}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Срочность продажи" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="URGENT_30_DAYS">Срочно (до 1 мес)</SelectItem>
                                        <SelectItem value="NORMAL_90_DAYS">Обычная (1-3 мес)</SelectItem>
                                        <SelectItem value="FLEXIBLE_180_DAYS">Не срочно (3+ мес)</SelectItem>
                                        <SelectItem value="NO_RUSH">Я не спешу</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? "Сохранение..." : "Сохранить и продолжить"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
