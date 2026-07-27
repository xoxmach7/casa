
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import StrategiesPage from "@/app/dashboard/strategies/page";

interface StrategiesSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function StrategiesSheet({ open, onOpenChange }: StrategiesSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden flex flex-col">
                <SheetHeader className="px-6 pt-6 pb-2">
                    <SheetTitle>Справочник Стратегий</SheetTitle>
                    <SheetDescription>
                        Описание всех доступных стратегий продажи.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <StrategiesPage />
                </div>
            </SheetContent>
        </Sheet>
    );
}
