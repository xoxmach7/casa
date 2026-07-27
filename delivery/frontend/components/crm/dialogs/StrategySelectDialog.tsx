import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StrategyDescriptions } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StrategyGrid } from "../StrategyGrid";
import { StrategyType } from "@/types/kanban";
import { toast } from "sonner";
import api from "@/lib/api-client";
import { Loader2, Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface StrategySelectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sellerId: string;
    onSuccess: (strategy: string) => void;
}

export function StrategySelectDialog({
    open,
    onOpenChange,
    sellerId,
    onSuccess,
}: StrategySelectDialogProps) {
    const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedStrategy || !sellerId) return;

        setIsSubmitting(true);
        try {
            // Apply strategy to the seller (which internally applies to properties or we might need a specific endpoint)
            // For now, let's assume we update the seller's properties via a loop or a bulk endpoint, 
            // or maybe the backend handles it. 
            // The prompt said "Now we assign strategies...". 
            // Usually strategy is on the Property. But the Seller is being moved.
            // We should probably update all properties of this seller to this strategy.

            // Let's call a custom endpoint or just update properties one by one if no bulk exists.
            // Or simpler: The requirements say "when we move seller...". 
            // Let's assume there's an endpoint or we do it here.

            // We'll use the existing bulk update or just loop for now as we don't have a dedicated "apply strategy to seller" endpoint in the provided snippets.
            // Actually, we can just pass the strategy back to the parent component and let it handle the API calls? 
            // No, the dialog usually handles its own submission to be self-contained. 

            // Let's check `crm-properties.routes.ts` - there is `recalculate-strategy` but that's AI.
            // We need to SET a specific strategy manually.
            // We'll update the properties.

            // Wait, we can't easily get properties here without fetching. 
            // The parent `KanbanBoard` has the seller object. 
            // Maybe it's better to pass the save function or let the parent handle the API call.
            // BUT, strictly asking: "dialog window involves choosing strategy".

            // Let's IMPLEMENT the API call here if possible, or pass it back.
            // Passing it back is safer if we don't want to fetch properties here.
            // `onSuccess` can take the strategy string.

            onSuccess(selectedStrategy);
            onOpenChange(false);

        } catch (error) {
            console.error(error);
            toast.error("Ошибка сохранения стратегии");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="p-6 pb-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Выбор стратегии продажи</DialogTitle>
                        <DialogDescription>
                            Выберите одну из 12 стратегий CASA для этого клиента.
                            Стратегия определит дальнейший план действий.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-hidden flex bg-muted/10">
                    <ScrollArea className="flex-1 p-6 h-[60vh]">
                        <StrategyGrid
                            selectedStrategy={selectedStrategy}
                            onSelect={setSelectedStrategy}
                        />
                    </ScrollArea>
                </div>

                <div className="p-6 pt-4 border-t bg-background">
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Отмена
                        </Button>
                        <Button onClick={handleSubmit} disabled={!selectedStrategy || isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Применить стратегию
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
