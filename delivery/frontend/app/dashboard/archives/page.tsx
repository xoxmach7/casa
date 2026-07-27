"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Archive,
    RotateCcw,
    Trash2,
    User,
    Building,
    AlertTriangle,
    Search,
    RefreshCw
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

interface ArchivedSeller {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    updatedAt: string;
    broker?: { firstName: string; lastName: string };
    properties?: any[];
}

interface ArchivedProperty {
    id: string;
    residentialComplex: string;
    address: string;
    price: number;
    updatedAt: string;
    broker?: { firstName: string; lastName: string };
    seller?: { firstName: string; lastName: string };
}

export default function ArchivesPage() {
    const [sellers, setSellers] = useState<ArchivedSeller[]>([]);
    const [properties, setProperties] = useState<ArchivedProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [user, setUser] = useState<any>(null);

    // Dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteItem, setDeleteItem] = useState<{ type: 'seller' | 'property'; id: string; name: string } | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem("user");
        if (userData) setUser(JSON.parse(userData));
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sellersRes, propertiesRes] = await Promise.all([
                api.get('/sellers/archived'),
                api.get('/crm-properties/archived')
            ]);
            setSellers(sellersRes.data);
            setProperties(propertiesRes.data);
        } catch (error) {
            console.error('Fetch archived error:', error);
            toast.error('Ошибка загрузки архива');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (type: 'seller' | 'property', id: string) => {
        try {
            if (type === 'seller') {
                await api.post(`/sellers/${id}/restore`);
                setSellers(prev => prev.filter(s => s.id !== id));
            } else {
                await api.post(`/crm-properties/${id}/restore`);
                setProperties(prev => prev.filter(p => p.id !== id));
            }
            toast.success('Восстановлено из архива');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Ошибка восстановления');
        }
    };

    const handlePermanentDelete = async () => {
        if (!deleteItem) return;
        try {
            if (deleteItem.type === 'seller') {
                await api.delete(`/sellers/${deleteItem.id}/permanent`);
                setSellers(prev => prev.filter(s => s.id !== deleteItem.id));
            } else {
                await api.delete(`/crm-properties/${deleteItem.id}/permanent`);
                setProperties(prev => prev.filter(p => p.id !== deleteItem.id));
            }
            toast.success('Удалено навсегда');
            setDeleteDialogOpen(false);
            setDeleteItem(null);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Ошибка удаления');
        }
    };

    const formatDate = (date: string) => new Date(date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(price);

    const filteredSellers = sellers.filter(s =>
        s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm)
    );

    const filteredProperties = properties.filter(p =>
        p.residentialComplex.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        );
    }

    const isAdmin = user?.role === 'ADMIN';

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Archive className="h-8 w-8 text-orange-500" />
                        Архив
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Управление архивными записями. Вы можете восстановить их или удалить окончательно.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Обновить
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Поиск по архиву..."
                    className="border-none shadow-none focus-visible:ring-0 px-0 h-auto"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <Tabs defaultValue="sellers" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="sellers" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Продавцы ({filteredSellers.length})
                    </TabsTrigger>
                    <TabsTrigger value="properties" className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Объекты ({filteredProperties.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sellers" className="mt-6">
                    <Card>
                        <CardHeader className="pb-3 border-b mb-1">
                            <CardTitle>Архив продавцов</CardTitle>
                            <CardDescription>
                                Список продавцов, перемещенных в архив.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {filteredSellers.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Archive className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>Архив продавцов пуст</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Продавец</TableHead>
                                            <TableHead>Телефон</TableHead>
                                            <TableHead>Дата архивации</TableHead>
                                            <TableHead>Брокер</TableHead>
                                            <TableHead className="text-right">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredSellers.map((seller) => (
                                            <TableRow key={seller.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                                                            <User className="h-4 w-4 text-orange-600" />
                                                        </div>
                                                        <div>
                                                            <div>{seller.firstName} {seller.lastName}</div>
                                                            {seller.properties && seller.properties.length > 0 && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Объектов в архиве: {seller.properties.length}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{seller.phone}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {formatDate(seller.updatedAt)}
                                                </TableCell>
                                                <TableCell>
                                                    {seller.broker ? (
                                                        <Badge variant="outline">
                                                            {seller.broker.firstName} {seller.broker.lastName}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={() => handleRestore('seller', seller.id)}
                                                            title="Восстановить"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => {
                                                                setDeleteItem({ type: 'seller', id: seller.id, name: `${seller.firstName} ${seller.lastName}` });
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                            title="Удалить навсегда"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="properties" className="mt-6">
                    <Card>
                        <CardHeader className="pb-3 border-b mb-1">
                            <CardTitle>Архив объектов</CardTitle>
                            <CardDescription>
                                Список объектов недвижимости в архиве.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {filteredProperties.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Archive className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>Архив объектов пуст</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Объект</TableHead>
                                            <TableHead>Адрес</TableHead>
                                            <TableHead>Цена</TableHead>
                                            <TableHead>Дата архивации</TableHead>
                                            <TableHead>Брокер</TableHead>
                                            <TableHead className="text-right">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProperties.map((property) => (
                                            <TableRow key={property.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                            <Building className="h-4 w-4 text-blue-600" />
                                                        </div>
                                                        <div>
                                                            {property.residentialComplex}
                                                            {property.seller && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Продавец: {property.seller.firstName} {property.seller.lastName}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={property.address}>
                                                    {property.address}
                                                </TableCell>
                                                <TableCell className="font-medium text-green-600">
                                                    {formatPrice(Number(property.price))}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {formatDate(property.updatedAt)}
                                                </TableCell>
                                                <TableCell>
                                                    {property.broker ? (
                                                        <Badge variant="outline">
                                                            {property.broker.firstName} {property.broker.lastName}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={() => handleRestore('property', property.id)}
                                                            title="Восстановить"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => {
                                                                setDeleteItem({ type: 'property', id: property.id, name: property.residentialComplex });
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                            title="Удалить навсегда"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Permanent Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Удалить навсегда?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="block mb-2">
                                Вы собираетесь удалить <strong className="text-foreground">{deleteItem?.name}</strong>.
                            </span>
                            <span className="block text-destructive font-medium border-l-2 border-destructive pl-2 mt-2">
                                Это действие необратимо. Данные будут удалены из базы навсегда.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handlePermanentDelete}
                        >
                            Удалить навсегда
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
