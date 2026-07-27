"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Deal } from "./types";
import {
    Calendar,
    Home,
    User,
    Phone,
    MoreHorizontal,
    Bot,
    Globe,
    UserPlus,
    Clock
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DealCardProps {
    deal: Deal;
    onDelete?: () => void;
}

export function DealCard({ deal, onDelete }: DealCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: deal.id, data: { ...deal } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Helper to determine source icon
    const getSourceIcon = (source: string) => {
        if (source === 'BOT_DISTRIBUTION') return <Bot className="h-3 w-3 text-[#2E7D5E]" />;
        if (source === 'FORM_PERSONAL') return <Globe className="h-3 w-3 text-[#3A9D73]" />;
        return <UserPlus className="h-3 w-3 text-gray-500" />;
    };

    const getSourceLabel = (source: string) => {
        if (source === 'BOT_DISTRIBUTION') return 'Бот';
        if (source === 'FORM_PERSONAL') return 'Сайт/Форма';
        return 'Вручную';
    }

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`
                cursor-grab active:cursor-grabbing hover:shadow-md transition-all group
                border-l-4
            `}
        // Use inline style for dynamic border color if needed, or mapping
        // For now defaulting to primary logic or specific color prop if added
        // Assuming deal.color exists from schema update
        >
            {/* Left Border Color Strip */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                style={{ backgroundColor: (deal as any).color || '#3B82F6' }}
            />

            <CardContent className="p-3 space-y-3 pl-4">
                {/* Header: Title + Amount */}
                <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold text-sm leading-tight line-clamp-2">
                        {deal.notes || `Сделка #${deal.id.slice(-4)}`}
                    </div>
                </div>

                <div className="font-bold text-primary">
                    {Number(deal.amount).toLocaleString('ru-RU')} ₸
                </div>

                {/* Details */}
                <div className="space-y-1.5 pt-1">
                    {/* Broker (Admin View) */}
                    {(deal as any).broker && (
                        <div className="flex items-center text-xs text-[#2E7D5E] bg-[#2E7D5E]/5 px-1.5 py-0.5 rounded w-fit gap-1.5 mb-1">
                            <span className="font-medium">{(deal as any).broker.firstName} {(deal as any).broker.lastName}</span>
                        </div>
                    )}

                    {/* Client */}
                    {deal.client && (
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{deal.client.firstName} {deal.client.lastName}</span>
                        </div>
                    )}

                    {/* Phone (if available in client or notes) */}
                    {deal.client?.phone && (
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{deal.client.phone}</span>
                        </div>
                    )}

                    {/* Object Type */}
                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                        <Home className="h-3 w-3 shrink-0" />
                        <span>{deal.objectType === 'PROPERTY' ? 'Недвижимость' : 'Ипотека'}</span>
                    </div>
                </div>

                {/* Footer: Source + Date + Creator */}
                <div className="flex items-center justify-between pt-2 border-t mt-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title={`Источник: ${deal.source}`}>
                            {getSourceIcon(deal.source)}
                            <span>{getSourceLabel(deal.source)}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Дата создания">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(deal.createdAt), 'dd MMM', { locale: ru })}</span>
                        </div>
                    </div>

                    {/* More actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 -mr-1 text-muted-foreground hover:text-primary"
                                onPointerDown={(e: any) => e.stopPropagation()} // Prevent drag start
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onPointerDown={(e: any) => e.stopPropagation()}>
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/deals/${deal.id}`} className="cursor-pointer">
                                    Подробнее
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onDelete?.()}
                                className="text-red-600 focus:text-red-600 cursor-pointer"
                            >
                                Удалить
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}
