"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Trash2 } from "lucide-react";
import { getApiUrl, getAuthHeaders } from "@/lib/api-config";
import { toast } from "sonner";
import { Deal } from "./types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DealsTable() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchDeals();
    }, []);

    const fetchDeals = async () => {
        try {
            setIsLoading(true);
            const headers = getAuthHeaders();
            const res = await fetch(getApiUrl('/deals?limit=100'), { headers });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setDeals(data.deals);
        } catch (error) {
            console.error(error);
            toast.error("Не удалось загрузить список сделок");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(getApiUrl(`/deals/${id}`), {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (res.ok) {
                toast.success('Сделка удалена');
                fetchDeals(); // Refresh list
            } else {
                toast.error('Не удалось удалить сделку (нужны права админа)');
            }
        } catch (error) {
            toast.error('Ошибка при удалении');
        }
    };

    const filteredDeals = deals.filter(deal => {
        const q = searchQuery.toLowerCase();
        return (
            deal.client?.firstName?.toLowerCase().includes(q) ||
            deal.client?.lastName?.toLowerCase().includes(q) ||
            deal.amount.toString().includes(q) ||
            deal.id.toLowerCase().includes(q)
        );
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Поиск по сделкам..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название / ID</TableHead>
                            <TableHead>Клиент</TableHead>
                            <TableHead>Объект</TableHead>
                            <TableHead>Бюджет</TableHead>
                            <TableHead>Комиссия</TableHead>
                            <TableHead>Источник</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Дата</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDeals.map((deal) => (
                            <TableRow key={deal.id}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{deal.title || `Сделка #${deal.id.slice(-4)}`}</span>
                                        {deal.notes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{deal.notes}</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {deal.client ? (
                                        <div className="flex flex-col">
                                            <span>{deal.client.firstName} {deal.client.lastName}</span>
                                            <span className="text-xs text-muted-foreground">{deal.client.phone}</span>
                                        </div>
                                    ) : '-'}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{deal.objectType}</Badge>
                                </TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat('kk-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(deal.amount)}
                                </TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat('kk-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(deal.commission)}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs">{deal.source}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge>{deal.stage}</Badge>
                                </TableCell>
                                <TableCell>
                                    {new Date(deal.updatedAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Удалить сделку?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Это действие необратимо. Сделка будет удалена из системы.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(deal.id)} className="bg-destructive hover:bg-destructive/90">
                                                    Удалить
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
