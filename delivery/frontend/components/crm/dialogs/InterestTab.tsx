"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { User, Calendar, Plus, Save, Check, X, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreateOfferDialog } from "../forms/DealForms";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface InterestTabProps {
    propertyId: string;
    isSold?: boolean; // When true, disable adding shows/offers
}

const OfferStatusLabels: Record<string, string> = {
    PENDING: "На рассмотрении",
    ACCEPTED: "Принят",
    REJECTED: "Отклонён"
};

const OfferStatusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ACCEPTED: "bg-green-100 text-green-800 border-green-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200"
};

export function InterestTab({ propertyId, isSold = false }: InterestTabProps) {
    const queryClient = useQueryClient();
    const [isAddingShow, setIsAddingShow] = useState(false);
    const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);

    // Form state for new show
    const [selectedBuyerId, setSelectedBuyerId] = useState("");
    const [showDate, setShowDate] = useState("");
    const [showFeedback, setShowFeedback] = useState("");
    const [showRating, setShowRating] = useState("3");

    // Form state for new buyer (quick add)
    const [isAddingBuyer, setIsAddingBuyer] = useState(false);
    const [newBuyerName, setNewBuyerName] = useState("");
    const [newBuyerPhone, setNewBuyerPhone] = useState("");

    // State for Accept Offer Dialog
    const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
    const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
    const [acceptedDate, setAcceptedDate] = useState("");

    // --- QUERIES ---
    const { data: shows, isLoading: isLoadingShows } = useQuery({
        queryKey: ["shows", propertyId],
        queryFn: async () => {
            const res = await api.get(`/buyers/shows/${propertyId}`);
            return res.data;
        },
    });

    const { data: offers, isLoading: isLoadingOffers } = useQuery({
        queryKey: ["offers", propertyId],
        queryFn: async () => {
            const res = await api.get(`/buyers/offers/${propertyId}`);
            return res.data;
        },
    });

    const { data: buyers } = useQuery({
        queryKey: ["buyers"],
        queryFn: async () => {
            const res = await api.get("/buyers");
            return res.data;
        },
    });

    // --- MUTATIONS ---
    const createBuyerMutation = useMutation({
        mutationFn: async () => {
            return api.post("/buyers", {
                firstName: newBuyerName,
                phone: newBuyerPhone,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["buyers"] });
            setIsAddingBuyer(false);
            setNewBuyerName("");
            setNewBuyerPhone("");
            toast.success("Покупатель добавлен");
        },
        onError: () => toast.error("Ошибка добавления покупателя"),
    });

    const logShowMutation = useMutation({
        mutationFn: async () => {
            if (!selectedBuyerId) throw new Error("Выберите покупателя");

            // Ensure date is ISO
            const isoDate = showDate
                ? new Date(showDate).toISOString()
                : new Date().toISOString();

            return api.post(`/buyers/shows`, {
                propertyId,
                buyerId: selectedBuyerId,
                date: isoDate,
                status: "SCHEDULED",
                notes: showFeedback,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shows", propertyId] });
            queryClient.invalidateQueries({ queryKey: ["properties"] });
            setIsAddingShow(false);
            setShowFeedback("");
            setShowDate(""); // Reset date
            toast.success("Показ зафиксирован");
        },
        onError: (e: any) => toast.error(e.message || "Ошибка создания показа"),
    });

    // --- OFFER MUTATIONS ---
    const acceptOfferMutation = useMutation({
        mutationFn: async ({ offerId, acceptedAt }: { offerId: string; acceptedAt?: string }) => {
            return api.put(`/buyers/offers/${offerId}`, {
                status: "ACCEPTED",
                acceptedAt: acceptedAt || new Date().toISOString()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["offers", propertyId] });
            queryClient.invalidateQueries({ queryKey: ["properties"] });
            setAcceptDialogOpen(false);
            setSelectedOfferId(null);
            setAcceptedDate("");
            toast.success("Оффер принят! ✅");
        },
        onError: () => toast.error("Ошибка принятия оффера"),
    });

    const rejectOfferMutation = useMutation({
        mutationFn: async (offerId: string) => {
            return api.put(`/buyers/offers/${offerId}`, { status: "REJECTED" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["offers", propertyId] });
            toast.success("Оффер отклонён");
        },
        onError: () => toast.error("Ошибка отклонения оффера"),
    });

    return (
        <div className="space-y-6 pt-4">
            {/* ========== SHOWS SECTION ========== */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">История показов</h3>
                {!isSold && (
                    <Button size="sm" onClick={() => setIsAddingShow(!isAddingShow)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Зафиксировать показ
                    </Button>
                )}
            </div>

            {isAddingShow && (
                <div className="p-4 bg-gray-50 border rounded-lg space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <h4 className="font-medium text-sm">Новая запись о показе</h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Покупатель</label>
                            <div className="flex gap-2">
                                <Select value={selectedBuyerId} onValueChange={setSelectedBuyerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите покупателя" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {buyers?.map((b: any) => (
                                            <SelectItem key={b.id} value={b.id}>
                                                {b.firstName} {b.lastName} ({b.phone})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon" onClick={() => setIsAddingBuyer(!isAddingBuyer)}>
                                    <User className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium">Дата показа</label>
                            <Input
                                type="datetime-local"
                                value={showDate}
                                onChange={(e) => setShowDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {isAddingBuyer && (
                        <div className="p-3 bg-white border rounded border-indigo-100 grid grid-cols-2 gap-3 items-end">
                            <div className="space-y-1">
                                <label className="text-xs">Имя</label>
                                <Input value={newBuyerName} onChange={e => setNewBuyerName(e.target.value)} placeholder="Иван" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs">Телефон</label>
                                <Input value={newBuyerPhone} onChange={e => setNewBuyerPhone(e.target.value)} placeholder="+7..." />
                            </div>
                            <Button size="sm" onClick={() => createBuyerMutation.mutate()} disabled={createBuyerMutation.isPending}>
                                Сохранить
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-medium">Обратная связь (Клиент сказал...)</label>
                        <Textarea
                            placeholder="Минусы, плюсы, возражения..."
                            value={showFeedback}
                            onChange={(e) => setShowFeedback(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Оценка объекта клиентом:</span>
                            <Select value={showRating} onValueChange={setShowRating}>
                                <SelectTrigger className="w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                    <SelectItem value="4">4</SelectItem>
                                    <SelectItem value="5">5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => logShowMutation.mutate()} disabled={logShowMutation.isPending || !selectedBuyerId}>
                            <Save className="w-4 h-4 mr-2" />
                            Сохранить
                        </Button>
                    </div>
                </div>
            )}

            <div className="border rounded-md overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead>Покупатель</TableHead>
                            <TableHead>Фидбек</TableHead>
                            <TableHead>Оценка</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingShows ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Загрузка...</TableCell>
                            </TableRow>
                        ) : shows?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    Показов еще не было
                                </TableCell>
                            </TableRow>
                        ) : (
                            shows?.map((show: any) => (
                                <TableRow key={show.id}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {format(new Date(show.date), "d MMM HH:mm", { locale: ru })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{show.buyer.firstName} {show.buyer.lastName}</div>
                                        <div className="text-xs text-muted-foreground">{show.buyer.phone}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={show.feedback}>
                                        {show.feedback || "—"}
                                    </TableCell>
                                    <TableCell>
                                        {show.rating && (
                                            <Badge variant={show.rating >= 4 ? "default" : show.rating >= 3 ? "secondary" : "destructive"}>
                                                {show.rating}/5
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ========== OFFERS SECTION ========== */}
            <Separator className="my-6" />

            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Офферы (Предложения)
                </h3>
                {!isSold && (
                    <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => setIsOfferDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Новый оффер
                    </Button>
                )}
            </div>

            <div className="border rounded-md overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead>Покупатель</TableHead>
                            <TableHead>Сумма</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingOffers ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Загрузка...</TableCell>
                            </TableRow>
                        ) : !offers || offers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    Офферов пока нет
                                </TableCell>
                            </TableRow>
                        ) : (
                            offers?.map((offer: any) => (
                                <TableRow key={offer.id}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {format(new Date(offer.createdAt), "d MMM yyyy", { locale: ru })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{offer.buyer?.firstName} {offer.buyer?.lastName}</div>
                                        <div className="text-xs text-muted-foreground">{offer.buyer?.phone}</div>
                                    </TableCell>
                                    <TableCell className="font-bold text-green-700">
                                        {Number(offer.price).toLocaleString()} ₸
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={OfferStatusColors[offer.status] || ""}>
                                            {OfferStatusLabels[offer.status] || offer.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {offer.status === "PENDING" && (
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 border-green-200 text-green-700 hover:bg-green-50"
                                                    onClick={() => {
                                                        setSelectedOfferId(offer.id);
                                                        setAcceptDialogOpen(true);
                                                    }}
                                                    disabled={acceptOfferMutation.isPending}
                                                >
                                                    <Check className="w-3 h-3 mr-1" /> Принять
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 border-red-200 text-red-700 hover:bg-red-50"
                                                    onClick={() => rejectOfferMutation.mutate(offer.id)}
                                                    disabled={rejectOfferMutation.isPending}
                                                >
                                                    <X className="w-3 h-3 mr-1" /> Отклонить
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* CREATE OFFER DIALOG */}
            <CreateOfferDialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen} propertyId={propertyId} />

            {/* ACCEPT OFFER DIALOG */}
            <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-700">
                            <Check className="w-5 h-5" /> Принятие оффера
                        </DialogTitle>
                        <DialogDescription>
                            Укажите дату принятия оффера для фиксации в системе.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="acceptDate">Дата принятия</Label>
                            <Input
                                id="acceptDate"
                                type="date"
                                value={acceptedDate}
                                onChange={(e) => setAcceptedDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                                if (selectedOfferId) {
                                    const acceptedAt = acceptedDate
                                        ? new Date(acceptedDate).toISOString()
                                        : new Date().toISOString();
                                    acceptOfferMutation.mutate({ offerId: selectedOfferId, acceptedAt });
                                }
                            }}
                            disabled={acceptOfferMutation.isPending}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            {acceptOfferMutation.isPending ? "Сохранение..." : "Подтвердить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
