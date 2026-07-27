"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, Home, MapPin, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CrmProperty, PropertyFunnelStage } from "@/types/kanban";

interface PropertiesListViewProps {
    onEdit: (property: CrmProperty) => void;
    activeFunnelId: string | null;
}

export function PropertiesListView({ onEdit, activeFunnelId }: PropertiesListViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const { data, isLoading } = useQuery({
        queryKey: ["properties", "list"],
        queryFn: async () => {
            // Reusing the kanban endpoint but we might want a dedicated list endpoint later
            // For now, filtering client-side is fine for MVP
            // Fetching more items to support client-side filtering/pagination for now
            const res = await api.get("/crm-properties", { params: { limit: 100 } });
            return res.data.properties as CrmProperty[];
        },
    });

    // Filter and Search
    const filteredProperties = data?.filter((property) => {
        const matchesSearch =
            !searchQuery ||
            property.residentialComplex.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (property.address || "").toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSearch;
    }) || [];

    // Pagination
    const totalPages = Math.ceil(filteredProperties.length / pageSize);
    const paginatedProperties = filteredProperties.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    const getStageLabel = (stage: string) => {
        const stages: Record<string, string> = {
            [PropertyFunnelStage.CREATED]: "Создан",
            [PropertyFunnelStage.PREPARATION]: "Подготовка",
            [PropertyFunnelStage.LEADS]: "Лиды",
            [PropertyFunnelStage.SHOWS]: "Показы",
            [PropertyFunnelStage.DEAL]: "Сделка",
            [PropertyFunnelStage.SOLD]: "Продано",
            [PropertyFunnelStage.CANCELLED]: "Отмена",
        };
        return stages[stage] || stage;
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("ru-RU", {
            style: "currency",
            currency: "KZT",
            maximumFractionDigits: 0,
        }).format(price);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по названию или адресу..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Объект</TableHead>
                            <TableHead>Цена</TableHead>
                            <TableHead>Этап</TableHead>
                            <TableHead>Продавец</TableHead>
                            <TableHead>Дата создания</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        ) : paginatedProperties.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Объекты не найдены
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedProperties.map((property) => (
                                <TableRow key={property.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onEdit(property)}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Home className="h-4 w-4 text-muted-foreground" />
                                                <span>{property.residentialComplex}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                {property.address || "-"}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatPrice(parseFloat(property.price))}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{getStageLabel(property.funnelStage)}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {property.seller ? (
                                            <div className="flex items-center gap-1 text-sm">
                                                <User className="h-3 w-3 text-muted-foreground" />
                                                {property.seller.firstName} {property.seller.lastName}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(property.createdAt), "d MMM yyyy", { locale: ru })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" onClick={() => onEdit(property)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Simple Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Назад
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Страница {page} из {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Вперед
                    </Button>
                </div>
            )}
        </div>
    );
}
