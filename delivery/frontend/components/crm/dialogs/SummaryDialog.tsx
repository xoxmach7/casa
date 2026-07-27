"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CrmProperty, Seller } from "@/types/kanban";
import { Building2, Wallet, Hammer, Brain, User, Calendar, MapPin, TrendingUp, AlertTriangle, MessageSquare, Home, Phone, Hash, Info, Image as ImageIcon, X, ZoomIn } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InterestTab } from "./InterestTab";
import { toast } from "sonner";
import {
    PropertyClassLabels,
    FunnelStageLabels,
    RepairStateLabels,
    LiquidityLevelLabels,
    StrategyDescriptions
} from "@/lib/translations";
import { useStrategy } from "@/lib/strategy-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomFieldsSection } from "../CustomFieldsSection";
import { CustomFieldEntity } from "@/types/kanban";

interface SummaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: Seller | CrmProperty;
    type: "Seller" | "Property";
    initialActivePropertyId?: string | null;
}

export function SummaryDialog({ open, onOpenChange, data, type, initialActivePropertyId }: SummaryDialogProps) {
    const { getLabel } = useStrategy();
    const queryClient = useQueryClient();
    // 1. Internal Navigation State
    const [activePropertyId, setActivePropertyId] = useState<string | null>(initialActivePropertyId || null);

    // Sync init prop when opening
    useState(() => {
        if (open && initialActivePropertyId) {
            setActivePropertyId(initialActivePropertyId);
        }
    });

    // 2. Fetch Full Data (Sellers or Properties)
    const { data: fetchedSeller } = useQuery({
        queryKey: ["seller", data?.id],
        queryFn: async () => {
            const res = await api.get(`/sellers/${data.id}`);
            return res.data;
        },
        enabled: open && type === "Seller" && !!data?.id,
    });

    const { data: fetchedProperty } = useQuery({
        queryKey: ["property", data?.id],
        queryFn: async () => {
            const res = await api.get(`/crm-properties/${data.id}`);
            return res.data;
        },
        enabled: open && type === "Property" && !!data?.id,
    });

    if (!data) return null;

    // 3. Resolve View Data
    const activeProperty = activePropertyId && fetchedSeller?.properties
        ? fetchedSeller.properties.find((p: any) => p.id === activePropertyId)
        : null;

    const isProperty = type === "Property" || !!activePropertyId;

    const property = isProperty
        ? (type === "Property" ? (fetchedProperty || data as CrmProperty) : activeProperty)
        : null;

    const simpleSeller = isProperty ? property?.seller : (fetchedSeller || data as Seller);
    const fullSeller = !isProperty ? (fetchedSeller || data as Seller) : null;

    // ... (keep helpers)
    const formatPrice = (p: string | number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", maximumFractionDigits: 0 }).format(Number(p));
    const repairState = PropertyClassLabels[property?.repairState || ""] || property?.repairState || "Не указан";
    const ceilingHeight = property?.ceilingHeight || "—";
    const parkingType = property?.parkingType || "—";

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                // Delay reset slightly to avoid flicker or reset immediately
                setTimeout(() => setActivePropertyId(null), 300);
            }
        }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            {/* Back Button for Drilldown */}
                            {!!activePropertyId && type === "Seller" && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mb-1 -ml-2 h-6 text-muted-foreground hover:text-primary gap-1 pl-2 pr-3"
                                    onClick={() => setActivePropertyId(null)}
                                >
                                    <span className="text-lg leading-none pb-1">←</span> Назад к списку
                                </Button>
                            )}

                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                {isProperty ? property?.residentialComplex : `${simpleSeller?.firstName} ${simpleSeller?.lastName}`}
                                {isProperty && property?.calculatedClass && (
                                    <Badge variant="outline" className="ml-2 font-normal text-xs">
                                        {PropertyClassLabels[property.calculatedClass] || property.calculatedClass}
                                    </Badge>
                                )}
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-2">
                                {isProperty ? (
                                    <>
                                        <MapPin className="w-3 h-3" />
                                        {property?.address}
                                        {property?.aiRecommendation && (
                                            <Badge variant="destructive" className="ml-2 animate-pulse">
                                                AI: Советует смену стратегии
                                            </Badge>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Phone className="w-3 h-3" />
                                        {simpleSeller?.phone} • Доверие: <span className="font-bold text-primary">{simpleSeller?.trustLevel}/5</span>
                                    </>
                                )}
                            </DialogDescription>
                        </div>
                        {/* Badges */}
                        {isProperty && property?.activeStrategy && (
                            <Badge className="bg-indigo-600 hover:bg-indigo-700">
                                {getLabel(property.activeStrategy) || property.activeStrategy}
                            </Badge>
                        )}
                        {fullSeller && fullSeller.funnelStage && (
                            <Badge variant="secondary">
                                {FunnelStageLabels[fullSeller.funnelStage] || fullSeller.funnelStage}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
                    <div className="px-6 border-b">
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                            <TabsTrigger
                                value="overview"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                            >
                                Обзор
                            </TabsTrigger>
                            {isProperty && (
                                <TabsTrigger
                                    value="interest"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    Интерес (Показы)
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <TabsContent value="overview" className="mt-0 space-y-6 pb-6">
                            {/* ================= PROPERTY VIEW ================= */}
                            {isProperty && property && (
                                <>
                                    {/* ========== SOLD DEAL INFO ========== */}
                                    {(property.funnelStage === 'SOLD' || property.status === 'SOLD') && (
                                        <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="bg-green-500 p-2 rounded-full">
                                                    <TrendingUp className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-green-800 text-lg">Сделка закрыта!</h3>
                                                    <p className="text-xs text-green-600">Объект успешно продан</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                                                    <div className="text-xs text-muted-foreground mb-1">Финальная цена</div>
                                                    <div className="font-bold text-green-700">{formatPrice(property.price)}</div>
                                                </div>
                                                <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                                                    <div className="text-xs text-muted-foreground mb-1">Дата закрытия</div>
                                                    <div className="font-medium">{property.updatedAt ? new Date(property.updatedAt).toLocaleDateString('ru-RU') : '—'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI RECOMMENDATION ALERT */}
                                    {property.aiRecommendation && (
                                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 text-red-900">
                                            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                                            <div>
                                                <div className="font-bold text-sm">Важная рекомендация AI</div>
                                                <p className="text-sm">{property.aiRecommendation}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI STRATEGY ANALYSIS */}
                                    {/* ... rest of original content ... */}
                                    {/* AI ANALYSIS */}
                                    {property.activeStrategy && (
                                        <div className="mb-6 rounded-xl border border-indigo-100 overflow-hidden bg-white shadow-sm">
                                            {/* Header / Verdict */}
                                            <div className="bg-gradient-to-r from-indigo-50 to-white p-4 border-b border-indigo-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-indigo-100/50 p-2 rounded-lg">
                                                            <Brain className="h-6 w-6 text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                                                                {property.isStrategyManual ? "Стратегия (ручная)" : "AI Strategy Verdict"}
                                                            </div>
                                                            <div className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                                                {getLabel(property.activeStrategy) || property.activeStrategy}
                                                                {property.calculatedClass && (
                                                                    <span className="text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                                        {property.calculatedClass}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Change Strategy Button */}
                                                    <div className="flex items-center gap-2">
                                                        {property.isStrategyManual && property.recommendedStrategy && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-xs h-7"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await api.put(`/crm-properties/${property.id}/strategy`, { resetToRecommended: true });
                                                                        toast.success("Стратегия сброшена на рекомендуемую");
                                                                        queryClient.invalidateQueries({ queryKey: ["sellers"] });
                                                                        queryClient.invalidateQueries({ queryKey: ["properties"] });
                                                                    } catch { toast.error("Ошибка сброса стратегии"); }
                                                                }}
                                                            >
                                                                Сбросить на AI
                                                            </Button>
                                                        )}
                                                        <select
                                                            className="text-xs border rounded px-2 py-1 bg-white cursor-pointer"
                                                            value={property.activeStrategy}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => {
                                                                const newStrategy = e.target.value;
                                                                try {
                                                                    await api.put(`/crm-properties/${property.id}/strategy`, { activeStrategy: newStrategy });
                                                                    toast.success("Стратегия изменена");
                                                                    // Update local state immediately
                                                                    property.activeStrategy = newStrategy;
                                                                    property.isStrategyManual = true;
                                                                    queryClient.invalidateQueries({ queryKey: ["sellers"] });
                                                                    queryClient.invalidateQueries({ queryKey: ["properties"] });
                                                                    // Force re-render
                                                                    onOpenChange(false);
                                                                    setTimeout(() => onOpenChange(true), 100);
                                                                } catch (err: any) {
                                                                    console.error('Strategy change error:', err);
                                                                    toast.error(err?.response?.data?.error || "Ошибка смены стратегии");
                                                                }
                                                            }}
                                                        >
                                                            {Object.entries(StrategyDescriptions).map(([key, s]) => (
                                                                <option key={key} value={key}>{s.code} {s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-5 space-y-5">
                                                {/* Loading State or Content */}
                                                {(() => {
                                                    if (!property.strategyExplanation) return (
                                                        <p className="text-sm text-muted-foreground italic">Обоснование еще не сгенерировано.</p>
                                                    );

                                                    let content: { reasoning: string; script: string } | null = null;
                                                    let rawText = property.strategyExplanation;
                                                    try {
                                                        if (rawText.trim().startsWith("{")) {
                                                            content = JSON.parse(rawText);
                                                        }
                                                    } catch (e) {
                                                        content = null;
                                                    }

                                                    if (content) {
                                                        return (
                                                            <>
                                                                <div>
                                                                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                                                                        <TrendingUp className="h-3 w-3" /> Почему выбрана эта стратегия?
                                                                    </h4>
                                                                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100/50">
                                                                        {content.reasoning}
                                                                    </p>
                                                                </div>

                                                                <div>
                                                                    <h4 className="text-xs font-bold uppercase text-green-700/80 mb-2 flex items-center gap-1">
                                                                        <MessageSquare className="h-3 w-3" /> Скрипт для брокера
                                                                    </h4>
                                                                    <div className="bg-green-50/80 border border-green-100 rounded-lg p-4 relative">
                                                                        <div className="absolute top-3 left-3 text-green-300">
                                                                            <MessageSquare className="h-4 w-4 opacity-20" />
                                                                        </div>
                                                                        <p className="text-sm text-green-900 italic pl-2 border-l-2 border-green-300">
                                                                            "{content.script}"
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    } else {
                                                        return (
                                                            <div>
                                                                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Анализ</h4>
                                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{rawText}</p>
                                                            </div>
                                                        )
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* INFO GRID */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                    <Building2 className="h-3 w-3" /> Базовые данные
                                                </h4>
                                                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                                                    <dt className="text-muted-foreground">Площадь</dt>
                                                    <dd className="font-medium text-right">{property.area} м²</dd>
                                                    <dt className="text-muted-foreground">Этаж</dt>
                                                    <dd className="font-medium text-right">{property.floor}/{property.totalFloors}</dd>
                                                    <dt className="text-muted-foreground">Год</dt>
                                                    <dd className="font-medium text-right">{property.yearBuilt}</dd>
                                                    {property.elevatorCount !== undefined && (
                                                        <>
                                                            <dt className="text-muted-foreground">Лифты</dt>
                                                            <dd className="font-medium text-right">{property.elevatorCount} {property.hasFreightElevator ? '(+Груз)' : ''}</dd>
                                                        </>
                                                    )}
                                                </dl>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                    <Hammer className="h-3 w-3" /> Характеристики
                                                </h4>
                                                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                                                    <dt className="text-muted-foreground">Ремонт</dt>
                                                    <dd className="font-medium text-right">{repairState}</dd>
                                                    <dt className="text-muted-foreground">Потолки</dt>
                                                    <dd className="font-medium text-right">{ceilingHeight} м</dd>
                                                    <dt className="text-muted-foreground">Паркинг</dt>
                                                    <dd className="font-medium text-right">{parkingType}</dd>
                                                </dl>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                    <Wallet className="h-3 w-3" /> Финансы
                                                </h4>
                                                <div className="bg-green-50 rounded-md p-3 border border-green-100 mb-3">
                                                    <div className="text-xs text-green-700 mb-1">Желаемая цена</div>
                                                    <div className="text-lg font-bold text-green-800">{formatPrice(property.price)}</div>
                                                </div>
                                                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                                                    <dt className="text-muted-foreground">Ликвидность</dt>
                                                    <dd className={`font-medium text-right ${property.liquidityScore < 50 ? "text-orange-600" : ""}`}>
                                                        {LiquidityLevelLabels[property.liquidityLevel || ""] || property.liquidityLevel} ({property.liquidityScore}/100)
                                                    </dd>
                                                    <dt className="text-muted-foreground">Ипотека</dt>
                                                    <dd className="font-medium text-right">{property.financeType === 'CASH_ONLY' ? 'Только нал' : 'Доступна'}</dd>
                                                    {property.isMortgaged && (
                                                        <>
                                                            <dt className="text-orange-600">В залоге</dt>
                                                            <dd className="font-medium text-right text-orange-600">{property.mortgageBank}</dd>
                                                            <dt className="text-muted-foreground">Остаток</dt>
                                                            <dd className="font-medium text-right">{property.mortgageRemaining ? formatPrice(property.mortgageRemaining) : '—'}</dd>
                                                        </>
                                                    )}
                                                </dl>
                                            </div>

                                            {/* Extra Technical Details Block */}
                                            <div className="pt-2 border-t mt-4">
                                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                    <Info className="h-3 w-3" /> Дополнительно
                                                </h4>
                                                <dl className="grid grid-cols-2 gap-y-2 text-xs">
                                                    <dt className="text-muted-foreground">Мебель</dt>
                                                    <dd className="text-right truncate">{property.furnitureLevel || "—"}</dd>
                                                    <dt className="text-muted-foreground">Техника</dt>
                                                    <dd className="text-right truncate">{property.appliancesLevel || "—"}</dd>
                                                    {property.encumbranceType && property.encumbranceType !== 'NONE' && (
                                                        <>
                                                            <dt className="text-red-500">Обременение</dt>
                                                            <dd className="text-right text-red-500 font-medium">{property.encumbranceType}</dd>
                                                        </>
                                                    )}
                                                </dl>
                                            </div>

                                            {property.seller && (
                                                <div className="pt-2 border-t mt-4">
                                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                        <User className="h-3 w-3" /> Продавец
                                                    </h4>
                                                    <div className="p-3 bg-gray-50 rounded-md border text-sm space-y-1">
                                                        <div className="font-medium">{property.seller.firstName} {property.seller.lastName}</div>
                                                        <div className="text-muted-foreground text-xs">{property.seller.phone}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* IMAGE GALLERY */}
                                            {property.images && property.images.length > 0 && (
                                                <div className="pt-4 border-t mt-4">
                                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                        <ImageIcon className="h-3 w-3" /> Фотографии ({property.images.length})
                                                    </h4>
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                        {property.images.map((url: string, idx: number) => (
                                                            <a
                                                                key={idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="group relative aspect-square rounded-lg overflow-hidden border bg-gray-100 hover:ring-2 hover:ring-primary/50 transition-all"
                                                            >
                                                                <img
                                                                    src={url}
                                                                    alt={`Фото ${idx + 1}`}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <CustomFieldsSection
                                        entityType={CustomFieldEntity.PROPERTY}
                                        entityId={property.id}
                                        customFieldValues={property.customFieldValues}
                                        customStage={property.customStage}
                                    />
                                </>
                            )}

                            {/* ================= SELLER VIEW ================= */}
                            {fullSeller && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-4 rounded-lg border bg-gray-50 space-y-2">
                                            <div className="text-xs text-muted-foreground uppercase font-bold">Активных сделок</div>
                                            <div className="text-2xl font-bold">{fullSeller._count?.properties || 0}</div>
                                        </div>
                                        <div className="p-4 rounded-lg border bg-gray-50 space-y-2">
                                            <div className="text-xs text-muted-foreground uppercase font-bold">Дата регистрации</div>
                                            <div className="text-sm font-medium">{new Date(fullSeller.updatedAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                            <Home className="w-4 h-4" /> Объекты продавца
                                        </h4>

                                        {fullSeller.properties && fullSeller.properties.length > 0 ? (
                                            <div className="space-y-3">
                                                {fullSeller.properties.map((p: any) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => setActivePropertyId(p.id)}
                                                        className="group flex items-center justify-between p-4 border rounded-lg bg-card hover:shadow-sm transition-all hover:border-primary/50 cursor-pointer hover:bg-indigo-50/50"
                                                    >
                                                        <div>
                                                            <div className="font-medium text-indigo-900 group-hover:text-indigo-700 flex items-center gap-2">
                                                                {p.residentialComplex}
                                                                {p.activeStrategy && (
                                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-indigo-50 text-indigo-700 border-indigo-200">
                                                                        {getLabel(p.activeStrategy) || p.activeStrategy}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground mt-1">
                                                                {formatPrice(p.price)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-xs">
                                                                {p.funnelStage}
                                                            </Badge>
                                                            {p.repairState && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {RepairStateLabels[p.repairState] || p.repairState}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground bg-gray-50 border border-dashed rounded-lg">
                                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 mb-3">
                                                    <Hash className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <p>У данного продавца пока нет объектов.</p>
                                            </div>
                                        )}
                                    </div>

                                    {fullSeller.managerComment && (
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2">Комментарий менеджера</h4>
                                            <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-lg text-sm text-yellow-900">
                                                {fullSeller.managerComment}
                                            </div>
                                        </div>
                                    )}

                                    <CustomFieldsSection
                                        entityType={CustomFieldEntity.SELLER}
                                        entityId={fullSeller.id}
                                        customFieldValues={fullSeller.customFieldValues}
                                        customStage={fullSeller.customStage}
                                    />
                                </div>
                            )}
                        </TabsContent>

                        {isProperty && property && (
                            <TabsContent value="interest" className="mt-0">
                                <InterestTab
                                    propertyId={property.id}
                                    isSold={property.funnelStage === 'SOLD' || property.status === 'SOLD'}
                                />
                            </TabsContent>
                        )}
                    </div>
                </Tabs>
            </DialogContent >
        </Dialog >
    );
}
