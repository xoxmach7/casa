"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, UserX, Building2 } from "lucide-react";

export type CancellationReason = "CLIENT_REFUSED" | "WE_REFUSED";

interface RefusalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: CancellationReason, comment?: string) => void;
    itemType: "seller" | "property";
    itemName?: string;
}

export function RefusalDialog({
    open,
    onOpenChange,
    onConfirm,
    itemType,
    itemName,
}: RefusalDialogProps) {
    const [reason, setReason] = useState<CancellationReason | null>(null);
    const [comment, setComment] = useState("");

    const handleConfirm = () => {
        if (!reason) return;
        onConfirm(reason, comment || undefined);
        setReason(null);
        setComment("");
    };

    const handleCancel = () => {
        setReason(null);
        setComment("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        Причина отказа
                    </DialogTitle>
                    <DialogDescription>
                        {itemType === "seller"
                            ? `Укажите причину отказа для продавца${itemName ? ` "${itemName}"` : ""}`
                            : `Укажите причину отказа для объекта${itemName ? ` "${itemName}"` : ""}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <Label className="text-base font-medium">Кто отказался? *</Label>
                        <RadioGroup
                            value={reason || ""}
                            onValueChange={(v) => setReason(v as CancellationReason)}
                            className="grid grid-cols-1 gap-3"
                        >
                            <label
                                htmlFor="client-refused"
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${reason === "CLIENT_REFUSED"
                                        ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                                        : "border-muted hover:border-red-200"
                                    }`}
                            >
                                <RadioGroupItem value="CLIENT_REFUSED" id="client-refused" />
                                <UserX className="h-5 w-5 text-red-500" />
                                <div>
                                    <div className="font-medium">Клиент отказался</div>
                                    <div className="text-sm text-muted-foreground">
                                        Клиент решил не продолжать сотрудничество
                                    </div>
                                </div>
                            </label>

                            <label
                                htmlFor="we-refused"
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${reason === "WE_REFUSED"
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                                        : "border-muted hover:border-orange-200"
                                    }`}
                            >
                                <RadioGroupItem value="WE_REFUSED" id="we-refused" />
                                <Building2 className="h-5 w-5 text-orange-500" />
                                <div>
                                    <div className="font-medium">Мы отказались</div>
                                    <div className="text-sm text-muted-foreground">
                                        Компания/брокер отказался от работы
                                    </div>
                                </div>
                            </label>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="comment">Комментарий (опционально)</Label>
                        <Textarea
                            id="comment"
                            placeholder="Укажите дополнительные детали..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Отмена
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!reason}
                    >
                        Подтвердить отказ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
