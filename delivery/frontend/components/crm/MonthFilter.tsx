"use client";

import * as React from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MonthFilterProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
}

export function MonthFilter({ date, setDate }: MonthFilterProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Generate last 12 months
    const months = React.useMemo(() => {
        const arr = [];
        const today = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            arr.push(d);
        }
        return arr;
    }, []);

    const handleSelect = (value: string) => {
        if (value === "all") {
            setDate(undefined);
        } else {
            setDate(new Date(value));
        }
        setIsOpen(false);
    };

    return (
        <Select
            value={date ? date.toISOString() : "all"}
            onValueChange={handleSelect}
        >
            <SelectTrigger className="w-[180px] h-9">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Месяц" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Все время</SelectItem>
                {months.map((m) => (
                    <SelectItem key={m.toISOString()} value={m.toISOString()}>
                        {format(m, "LLLL yyyy", { locale: ru })}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
