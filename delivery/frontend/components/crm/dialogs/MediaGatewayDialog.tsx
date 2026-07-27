"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/ui/FileUploader"; // Updated import
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

interface MediaGatewayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    propertyId: string;
    imageCount: number;
    requiredCount?: number;
    onSuccess: () => void;
}

export function MediaGatewayDialog({
    open,
    onOpenChange,
    propertyId,
    imageCount,
    requiredCount = 0, // Photos are now optional
    onSuccess,
}: MediaGatewayDialogProps) {
    const [currentCount, setCurrentCount] = useState(imageCount);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset count when dialog opens with new property
    useEffect(() => {
        if (open) {
            setCurrentCount(imageCount);
        }
    }, [open, imageCount]);

    const handleFilesChange = (urls: string[]) => {
        // We only track images for the "count" visual, documents are bonus
        setCurrentCount(urls.length);
    };

    const handleContinue = async () => {
        // No longer blocking - just warn if no photos
        if (currentCount === 0) {
            // Allow but show info
        }

        setIsSubmitting(true);
        try {
            // Call onSuccess which will trigger the stage move
            onSuccess();
            onOpenChange(false);
            toast.success("Объект переведён на этап Подготовки");
        } catch (error) {
            toast.error("Ошибка при сохранении");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        Подготовка Объекта
                    </DialogTitle>
                    <DialogDescription>
                        Рекомендуем загрузить качественные фото и необходимые документы.
                        <br />
                        Загружено: <b className={currentCount > 0 ? "text-green-600" : "text-amber-600"}>{currentCount}</b> фото.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    <FileUploader
                        propertyId={propertyId}
                        onImagesChange={handleFilesChange}
                    // We can also track documents if needed
                    />
                </div>

                <DialogFooter className="flex row justify-between sm:justify-between items-center gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} type="button">
                        Отмена
                    </Button>
                    <Button
                        onClick={handleContinue}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {currentCount > 0 ? "Готово, продолжить" : "Продолжить без фото"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

