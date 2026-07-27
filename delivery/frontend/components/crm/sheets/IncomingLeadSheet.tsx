"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
    Phone,
    MapPin,
    Edit,
    User,
    MessageCircle,
    Instagram,
    Building2,
    TrendingUp,
    Banknote,
    Target,
    CheckCircle2,
    Sparkles,
    AlertTriangle,
    Clock,
    ArrowRight,
    Calendar,
    ThumbsUp,
    ThumbsDown,
    Plus, // Added Plus
    Star // Added Star
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Seller, CrmProperty } from "@/types/kanban";
import { useLeadReadiness } from "@/hooks/useLeadReadiness";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface IncomingLeadSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    seller: Seller | null;
    property: CrmProperty | null;
    onEditSeller: () => void;
    onOpenProperty: () => void;
    onConfirmStrategy: () => void;
}

export function IncomingLeadSheet({
    open,
    onOpenChange,
    seller,
    property,
    onEditSeller,
    onOpenProperty,
    onConfirmStrategy
}: IncomingLeadSheetProps) {
    const { score, alerts, isReadyForInterview } = useLeadReadiness(seller, property);

    // Data-driven prep items
    const prepItems = {
        price: Boolean(property?.price && Number(property.price) > 0),
        competitors: Boolean(property?.residentialComplex), // Simple check
        mortgage: Boolean(property?.isMortgaged || (seller && seller.plansToPurchase)), // Example logic
        strategy: Boolean(property?.activeStrategy || (seller && seller.strategyConfirmed))
    };

    // Timer logic
    const [timeLeft, setTimeLeft] = useState("23:59:00");

    useEffect(() => {
        // Just a static visual timer for now
        const timer = setInterval(() => {
            const now = new Date();
            const end = new Date();
            end.setHours(23, 59, 59);
            const diff = end.getTime() - now.getTime();
            // format HH:MM:SS... roughly
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const togglePrep = (key: keyof typeof prepItems) => {
        // No-op for now as it's data driven. Or maybe open a dialog?
        // User says "Click to light up" -> "Icons light up when data is filled"
        // If it's pure data-driven, clicking might open the form/analysis.
        // For now, let's keep it strictly read-only reflection of data.
        toast.info("Заполните данные, чтобы выполнить этот пункт.");
    };

    if (!seller) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <div className="p-0 h-full flex flex-col">
                {/* === HEADER === */}
                <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5 animate-pulse" />
                            {seller.funnelStage || 'Новый контакт'}
                        </Badge>
                        {/* Tabs Triggers in Header could be nice, but sticking to content body or standard Tabs */}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                        {/* Close */}
                    </Button>
                </div>

                <Tabs defaultValue="main" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-2 border-b">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="main">Основное</TabsTrigger>
                            <TabsTrigger value="shows" disabled={!property}>Показы</TabsTrigger>
                            <TabsTrigger value="offers" disabled={!property}>Офферы</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="main" className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* === OLD CONTENT === */}
                        <IncomingLeadMainContent
                            seller={seller}
                            property={property}
                            prepItems={prepItems}
                            score={score}
                            alerts={alerts}
                            isReadyForInterview={isReadyForInterview}
                            togglePrep={togglePrep}
                            onEditSeller={onEditSeller}
                            onOpenProperty={onOpenProperty}
                            onConfirmStrategy={onConfirmStrategy}
                        />
                    </TabsContent>

                    <TabsContent value="shows" className="flex-1 overflow-y-auto p-6 space-y-6">
                        <ShowsTab propertyId={property?.id} />
                    </TabsContent>

                    <TabsContent value="offers" className="flex-1 overflow-y-auto p-6 space-y-6">
                        <OffersTab propertyId={property?.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </Sheet>
    );
}

// Refactored Main Content to keep file clean
function IncomingLeadMainContent({ seller, property, prepItems, score, alerts, isReadyForInterview, togglePrep, onEditSeller, onOpenProperty, onConfirmStrategy }: any) {
    return (
        <>
            <div className="flex items-start justify-between">
                <div className="flex gap-4">
                    <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-indigo-100 text-indigo-600 font-bold text-xl">
                            {seller.firstName[0]}{seller.lastName[0]}
                        </AvatarFallback>
                    </Avatar>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{seller.firstName} {seller.lastName}</h2>
                        <div className="flex flex-col gap-1 mt-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                {seller.phone}
                                <MessageCircle className="h-3.5 w-3.5 text-green-500 cursor-pointer hover:scale-110 transition-transform" />
                            </div>
                            {/* ... Source/City ... */}
                        </div>
                    </div>
                </div>

                <Button variant="outline" size="icon" onClick={onEditSeller} className="shrink-0">
                    <Edit className="h-4 w-4 text-gray-600" />
                </Button>
            </div>

            <Separator />

            {/* === PROPERTY MINI CARD === */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Объект недвижимости</h3>
                    {property && (
                        <Button variant="link" className="h-auto p-0 text-xs text-indigo-600" onClick={onOpenProperty}>
                            Открыть
                        </Button>
                    )}
                </div>

                {property ? (
                    <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={onOpenProperty}>
                        <CardContent className="p-4 flex gap-4">
                            {property.images && property.images.length > 0 ? (
                                <img src={property.images[0]} alt="Property" className="w-16 h-16 rounded-md object-cover bg-gray-100" />
                            ) : (
                                <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center">
                                    <Building2 className="h-6 w-6 text-gray-400" />
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate">{property.residentialComplex}</h4>
                                <p className="text-sm text-gray-500 truncate">{property.address}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-5">{property.rooms}-комн.</Badge>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-green-50 text-green-700">
                                        {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", maximumFractionDigits: 0 }).format(Number(property.price))}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer" onClick={onOpenProperty}>
                        <Building2 className="h-8 w-8 text-gray-300" />
                        <p className="text-sm text-gray-500 font-medium">Объект не привязан</p>
                        <Button variant="link" size="sm" className="text-indigo-600">Добавить объект</Button>
                    </div>
                )}
            </div>

            {/* === PREPARATION GRID === */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Подготовка к звонку</h3>
                <div className="grid grid-cols-2 gap-3">
                    <PrepCard icon={Banknote} label="Проверка цены" active={prepItems.price} onClick={() => togglePrep('price')} />
                    <PrepCard icon={Building2} label="Конкуренты" active={prepItems.competitors} onClick={() => togglePrep('competitors')} />
                    <PrepCard icon={TrendingUp} label="Ипотека" active={prepItems.mortgage} onClick={() => togglePrep('mortgage')} />
                    <PrepCard icon={Target} label="Стратегия" active={prepItems.strategy} onClick={() => togglePrep('strategy')} />
                </div>
            </div>

            {/* === AI ADVICE === */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-100 rounded-full blur-2xl opacity-50" />
                <div className="flex gap-3 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-indigo-900 uppercase">Совет Casa AI</h4>
                        <p className="text-sm text-indigo-800 leading-relaxed">
                            {!property ?
                                "Спросите про ЖК и этажность. Это критично для оценки ликвидности." :
                                property.aiRecommendation || "Цена выглядит рыночной. Уточните про документы и готовность к торгу."
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* === READINESS (Sticky Bottom) === */}
            <div className="mt-auto border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Готовность к звонку</span>
                    <span className={cn("text-sm font-bold", score >= 80 ? "text-green-600" : "text-orange-500")}>
                        {score}%
                    </span>
                </div>
                <Progress value={score} className="h-2 mb-4" />

                {alerts.length > 0 && (
                    <div className="space-y-1 mb-4">
                        {alerts.map((alert: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1.5 rounded-md">
                                <AlertTriangle className="h-3 w-3" />
                                {alert}
                            </div>
                        ))}
                    </div>
                )}

                <Button
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-200 transition-all text-white font-medium h-11"
                    disabled={!isReadyForInterview}
                    onClick={onConfirmStrategy}
                >
                    {isReadyForInterview ? (
                        <>Перейти к интервью <ArrowRight className="ml-2 h-4 w-4" /></>
                    ) : "Заполните данные для интервью"}
                </Button>
            </div>
        </>
    );
}

// Helper Sub-component
function PrepCard({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none",
                active ? "border-green-500 bg-green-50" : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
            )}
        >
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                active ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"
            )}>
                {active ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
            </div>
            <span className={cn("text-sm font-medium", active ? "text-green-800" : "text-gray-700")}>
                {label}
            </span>
        </div>
    );
}


// --- IMPORTED FORMS ---
import { CreateBuyerDialog, CreateShowDialog, FeedbackDialog, CreateOfferDialog } from "@/components/crm/forms/DealForms";

function ShowsTab({ propertyId }: { propertyId?: string }) {
    const { data: shows, isLoading } = useQuery({
        queryKey: ['shows', propertyId],
        queryFn: async () => {
            if (!propertyId) return [];
            const res = await api.get(`/buyers/shows/${propertyId}`); // Use api client (already has /api base)
            return res.data;
        },
        enabled: !!propertyId
    });

    // Form states
    const [isBuyerOpen, setIsBuyerOpen] = useState(false);
    const [isShowOpen, setIsShowOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [selectedShowId, setSelectedShowId] = useState<string | null>(null);


    if (!propertyId) return <div className="text-center p-8 text-gray-400">Сначала создайте объект</div>;

    return (
        <div className="space-y-4">
            {/* Dialogs */}
            <CreateBuyerDialog open={isBuyerOpen} onOpenChange={setIsBuyerOpen} />
            <CreateShowDialog open={isShowOpen} onOpenChange={setIsShowOpen} propertyId={propertyId} />
            {selectedShowId && <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} showId={selectedShowId} propertyId={propertyId} />}

            {/* Actions */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Покупатели</h3>
                    <Button size="sm" variant="secondary" className="h-8" onClick={() => setIsBuyerOpen(true)}>
                        <Plus className="h-3 w-3 mr-1.5" />
                        Новый Покупатель
                    </Button>
                </div>
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">График показов</h3>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setIsShowOpen(true)}>
                        <Calendar className="h-3 w-3 mr-1.5" />
                        Запланировать
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
            ) : shows?.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-xl bg-gray-50">
                    <p className="text-sm text-gray-500">Показов пока нет</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {shows?.map((show: any) => (
                        <Card key={show.id} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] h-5",
                                            show.status === 'COMPLETED' ? "bg-green-50 text-green-700 border-green-200" :
                                                show.status === 'CANCELLED' ? "bg-red-50 text-red-700 border-red-200" :
                                                    "bg-blue-50 text-blue-700 border-blue-200"
                                        )}>
                                            {show.status === 'COMPLETED' ? 'Проведен' : show.status === 'CANCELLED' ? 'Отменен' : 'Запланирован'}
                                        </Badge>
                                        <span className="text-xs font-medium text-gray-900">
                                            {format(new Date(show.date), "d MMM, HH:mm", { locale: ru })}
                                        </span>
                                    </div>
                                    {show.rating && (
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} className={cn("w-3 h-3", i < show.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200")} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                            {show.buyer?.firstName?.[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm text-gray-700">{show.buyer?.firstName} {show.buyer?.lastName}</span>
                                </div>

                                {show.feedback ? (
                                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 italic border-l-2 border-indigo-200">
                                        "{show.feedback}"
                                    </div>
                                ) : (
                                    show.status === 'SCHEDULED' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="w-full text-xs h-7 text-indigo-600 hover:bg-indigo-50"
                                            onClick={() => { setSelectedShowId(show.id); setFeedbackOpen(true); }}
                                        >
                                            <MessageCircle className="h-3 w-3 mr-1.5" />
                                            Оставить фидбек
                                        </Button>
                                    )
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

function OffersTab({ propertyId }: { propertyId?: string }) {
    const { data: offers, isLoading } = useQuery({
        queryKey: ['offers', propertyId],
        queryFn: async () => {
            const res = await api.get(`/buyers/offers/${propertyId}`);
            return res.data;
        },
        enabled: !!propertyId
    });

    const [isOfferOpen, setIsOfferOpen] = useState(false);

    if (!propertyId) return null;

    return (
        <div className="space-y-4">
            <CreateOfferDialog open={isOfferOpen} onOpenChange={setIsOfferOpen} propertyId={propertyId} />

            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Активные предложения</h3>
                <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsOfferOpen(true)}>
                    <ThumbsUp className="h-3 w-3 mr-1.5" />
                    Зафиксировать Оффер
                </Button>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[1].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
            ) : offers?.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">
                    <p className="text-sm text-gray-500 mb-2">Предложений пока нет</p>
                    <p className="text-xs text-gray-400">Внесите первое предложение от покупателя</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {offers?.map((offer: any) => (
                        <Card key={offer.id} className="border-green-100 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="text-lg font-bold text-green-700">
                                            {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", maximumFractionDigits: 0 }).format(Number(offer.price))}
                                        </h4>
                                        <p className="text-xs text-gray-500">{format(new Date(offer.createdAt), "d MMMM yyyy", { locale: ru })}</p>
                                    </div>
                                    <Badge className={cn(
                                        "text-[10px]",
                                        offer.status === 'PENDING' ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                                            offer.status === 'ACCEPTED' ? "bg-green-100 text-green-800 hover:bg-green-100" :
                                                "bg-gray-100 text-gray-800"
                                    )}>
                                        {offer.status === 'PENDING' ? 'Рассмотрение' : offer.status === 'ACCEPTED' ? 'Принят' : offer.status}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                            {offer.buyer?.firstName?.[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-gray-900">{offer.buyer?.firstName} {offer.buyer?.lastName}</span>
                                </div>

                                {offer.comment && (
                                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                        {offer.comment}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
