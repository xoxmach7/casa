"use client";

import * as React from "react";
import { startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DateFilterProps {
    dateRange: { from: Date | undefined; to: Date | undefined };
    setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

export function DateFilter({ dateRange, setDateRange }: DateFilterProps) {
    const [activePreset, setActivePreset] = React.useState<string>("all");

    const handlePreset = (key: string) => {
        setActivePreset(key);
        const now = new Date();
        switch (key) {
            case "today":
                setDateRange({ from: startOfDay(now), to: endOfDay(now) });
                break;
            case "week":
                setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
                break;
            case "month":
                setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                break;
            default:
                setDateRange({ from: undefined, to: undefined });
        }
    };

    const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDateRange({ from: val ? startOfDay(new Date(val)) : undefined, to: dateRange.to });
        setActivePreset("custom");
    };

    const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDateRange({ from: dateRange.from, to: val ? endOfDay(new Date(val)) : undefined });
        setActivePreset("custom");
    };

    return (
        <div className="flex items-center gap-1">
            <div className="flex bg-muted rounded-md p-0.5">
                {[
                    { key: "all", label: "Все" },
                    { key: "today", label: "Сегодня" },
                    { key: "week", label: "Неделя" },
                    { key: "month", label: "Месяц" },
                ].map((p) => (
                    <button
                        key={p.key}
                        onClick={() => handlePreset(p.key)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                            activePreset === p.key
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all ${
                            activePreset === "custom"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                    >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {activePreset === "custom" && dateRange.from && (
                            <span>
                                {format(dateRange.from, "dd.MM", { locale: ru })}
                                {dateRange.to ? ` — ${format(dateRange.to, "dd.MM", { locale: ru })}` : ""}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                    <div className="flex flex-col gap-3">
                        <p className="text-xs font-medium text-muted-foreground">Выберите период</p>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">От</label>
                                <input
                                    type="date"
                                    className="border rounded px-2 py-1.5 text-sm w-[140px]"
                                    value={dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                                    onChange={handleFromChange}
                                />
                            </div>
                            <span className="text-muted-foreground mt-4">—</span>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">До</label>
                                <input
                                    type="date"
                                    className="border rounded px-2 py-1.5 text-sm w-[140px]"
                                    value={dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                                    onChange={handleToChange}
                                />
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
