"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { StrategyGrid } from "@/components/crm/StrategyGrid";

export default function StrategiesPage() {
    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Стратегии Продажи</h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Справочник 12 стратегий CASA для эффективной работы с объектами недвижимости. Продажа должна быть управляемым процессом.
                    </p>
                </div>
            </div>

            <ScrollArea className="flex-1 h-full pb-10">
                <div className="pb-20">
                    <StrategyGrid />
                </div>
            </ScrollArea>
        </div>
    );
}
