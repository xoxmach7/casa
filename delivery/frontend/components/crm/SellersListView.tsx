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
import { Search, Edit, Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Seller, SellerFunnelStage } from "@/types/kanban";
import { useDebounce } from "@/hooks/use-debounce";

interface SellersListViewProps {
    onEdit: (seller: Seller) => void;
    activeFunnelId: string | null;
}

interface SellersResponse {
    sellers: Seller[];
    total: number;
}

export function SellersListView({ onEdit, activeFunnelId }: SellersListViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 500);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const { data, isLoading } = useQuery({
        queryKey: ["sellers", "list", page, debouncedSearch, activeFunnelId],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
            if (debouncedSearch) params.append("search", debouncedSearch);
            // activeFunnelId logic if needed in future

            const res = await api.get(`/sellers?${params.toString()}`);
            // Ensure response data handles potential missing fields gracefully
            return res.data as SellersResponse;
        },
    });

    const sellers = data?.sellers || [];
    const totalSellers = data?.total || 0;
    const totalPages = Math.ceil(totalSellers / pageSize);

    const getStageLabel = (stage: string) => {
        const stages: Record<string, string> = {
            [SellerFunnelStage.CONTACT]: "Контакт",
            [SellerFunnelStage.INTERVIEW]: "Интервью",
            [SellerFunnelStage.STRATEGY]: "Стратегия",
            [SellerFunnelStage.CONTRACT_SIGNING]: "Договор",
            [SellerFunnelStage.CANCELLED]: "Отмена",
        };
        return stages[stage] || stage;
    };

    const getTrustLevelBadge = (level: number) => {
        const colors = ["bg-red-100 text-red-800", "bg-orange-100 text-orange-800", "bg-yellow-100 text-yellow-800", "bg-blue-100 text-blue-800", "bg-green-100 text-green-800"];
        return (
            <Badge className={colors[Math.min(level, 5) - 1] || "bg-gray-100"}>
                {level}/5
            </Badge>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по имени или телефону..."
                        className="pl-9 w-full md:max-w-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                ) : sellers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Клиенты не найдены</div>
                ) : (
                    sellers.map((seller) => (
                        <div
                            key={seller.id}
                            className="bg-white p-4 rounded-lg border shadow-sm space-y-3 cursor-pointer active:scale-[0.99] transition-transform"
                            onClick={() => onEdit(seller)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-medium text-lg">{seller.firstName} {seller.lastName}</div>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                        <Phone className="h-3 w-3" />
                                        {seller.phone}
                                    </div>
                                </div>
                                <Badge variant="outline">{getStageLabel(seller.funnelStage)}</Badge>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Доверие:</span>
                                    {getTrustLevelBadge(seller.trustLevel)}
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(seller.createdAt), "d MMM", { locale: ru })}
                                </div>
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="secondary" className="w-full flex-1" onClick={() => window.open(`tel:${seller.phone}`)}>
                                    <Phone className="h-4 w-4 mr-2" />
                                    Позвонить
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => onEdit(seller)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Клиент</TableHead>
                            <TableHead>Телефон</TableHead>
                            <TableHead>Этап</TableHead>
                            <TableHead>Доверие</TableHead>
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
                        ) : sellers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Клиенты не найдены
                                </TableCell>
                            </TableRow>
                        ) : (
                            sellers.map((seller) => (
                                <TableRow key={seller.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onEdit(seller)}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{seller.firstName} {seller.lastName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            {seller.phone}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{getStageLabel(seller.funnelStage)}</Badge>
                                    </TableCell>
                                    <TableCell>{getTrustLevelBadge(seller.trustLevel)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(seller.createdAt), "d MMM yyyy", { locale: ru })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" onClick={() => onEdit(seller)}>
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

            {/* Pagination */}
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
