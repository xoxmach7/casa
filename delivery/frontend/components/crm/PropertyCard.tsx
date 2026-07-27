import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Building2, TrendingUp, HandCoins, MoreVertical, Trash2, ArrowRight } from "lucide-react";
import { CrmProperty, PropertyClass, StrategyType, PropertyFunnelStage } from "@/types/kanban";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface PropertyCardProps {
    property: CrmProperty;
    onDelete?: (id: string) => void;
    onStageChange?: (id: string, stage: PropertyFunnelStage) => void;
}

// Neutral gray-based class colors for minimalist design
const CLASS_COLORS: Record<PropertyClass, string> = {
    BUSINESS: "bg-secondary text-secondary-foreground border-border",
    COMFORT_PLUS: "bg-secondary text-secondary-foreground border-border",
    COMFORT: "bg-secondary text-secondary-foreground border-border",
    ECONOMY: "bg-muted text-muted-foreground border-border",
    OLD_FUND: "bg-muted text-muted-foreground border-border",
};

import { PropertyClassLabels, FunnelStageLabels } from "@/lib/translations";
import { useStrategy } from "@/lib/strategy-context";

import { defaultAnimateLayoutChanges } from "@dnd-kit/sortable";

import { useState } from "react";
import { Sparkles, Loader2, FileText, Eye, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SummaryDialog } from "./dialogs/SummaryDialog";
import { StrategyLoader } from "@/components/ui/StrategyLoader";
import { TradeInButton } from "./TradeInButton";

export function PropertyCardBase({ property, style, setNodeRef, attributes, listeners, isDragging, isOverlay, isSold, onDelete, onStageChange }: { property: CrmProperty; style?: any; setNodeRef?: any; attributes?: any; listeners?: any; isDragging?: boolean; isOverlay?: boolean; isSold?: boolean; onDelete?: (id: string) => void; onStageChange?: (id: string, stage: PropertyFunnelStage) => void }) {
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);
    const { getLabel } = useStrategy();
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Load user
    useState(() => {
        if (typeof window !== 'undefined') {
            const u = localStorage.getItem("user");
            if (u) setUser(JSON.parse(u));
        }
    });

    const isCritical =
        property.activeStrategy === StrategyType.REJECT_OBJECT ||
        property.activeStrategy === StrategyType.LOW_LIQUIDITY;

    const priceFormatted = new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "KZT",
        maximumFractionDigits: 0,
    }).format(Number(property.price));

    const handleGenerateStrategy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card drag/click
        e.preventDefault();

        if (isGenerating) return;

        setIsGenerating(true);
        // Toast is now handled visually by the loader, but we can keep a start toast if desired
        // toast.info("AI анализирует объект...");

        // Artifical delay for "Thinking" effect (3.5s)
        const delayPromise = new Promise(resolve => setTimeout(resolve, 3500));

        try {
            const requestPromise = api.post(`/crm-properties/${property.id}/recalculate-strategy`);

            // Wait for both delay and request
            await Promise.all([delayPromise, requestPromise]);

            toast.success("Стратегия обоснована!");
            queryClient.invalidateQueries({ queryKey: ["crm-properties"] });
        } catch (error) {
            toast.error("Ошибка генерации стратегии");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <Card
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={cn(
                    "mb-2 transition-all border group relative overflow-hidden touch-action-none",
                    isSold ? "cursor-not-allowed opacity-75" : "cursor-grab active:cursor-grabbing",
                    isOverlay ? "shadow-xl scale-105 rotate-2 cursor-grabbing" : "",
                    isDragging ? "opacity-50" : ""
                )}
            >
                {/* AI LOADER OVERLAY */}
                {isGenerating && <StrategyLoader />}

                <CardHeader className="p-3 pb-2">
                    <div className="flex justify-between items-start mb-1">
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] px-1.5 py-0 border font-medium",
                                property.calculatedClass
                                    ? CLASS_COLORS[property.calculatedClass]
                                    : "bg-gray-100"
                            )}
                        >
                            {PropertyClassLabels[property.calculatedClass || ""] || property.calculatedClass || "Не определен"}
                        </Badge>

                        {property.activeStrategy && (
                            <div className="flex items-center gap-1">
                                <Badge
                                    variant={isCritical ? "destructive" : "secondary"}
                                    className={cn("text-[10px] h-5 transition-all duration-500", !isGenerating && "animate-in fade-in zoom-in")} // Animate badge appearance
                                >
                                    {getLabel(property.activeStrategy) || property.activeStrategy}
                                </Badge>
                            </div>
                        )}

                        {/* Actions Menu - show for owner or admin */}
                        {(user?.role === 'ADMIN' || user?.id === property.broker?.id) && onDelete && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onPointerDown={(e: any) => e.stopPropagation()}>
                                    {onStageChange && (
                                        <>
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>
                                                    <ArrowRight className="h-4 w-4 mr-2" />
                                                    Переместить
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent>
                                                    {Object.values(PropertyFunnelStage).map((stage) => {
                                                        if (stage === property.funnelStage) return null;
                                                        if (stage === PropertyFunnelStage.CANCELLED) return null; // Archive/Cancel has separate button usually, or allow it? Let's hide it from "Move" if it means "Archive" logic. 
                                                        // Actually "CANCELLED" is a valid stage, but "ARCHIVED" is usually a status or deletion.
                                                        // The old code list didn't include 'CANCELLED'. I'll exclude it to match previous intent or if it's treated as separate action.

                                                        return (
                                                            <DropdownMenuItem
                                                                key={stage}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onStageChange(property.id, stage);
                                                                }}
                                                            >
                                                                {FunnelStageLabels[stage] || stage}
                                                            </DropdownMenuItem>
                                                        );
                                                    })}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuSeparator />
                                        </>
                                    )}

                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteDialogOpen(true);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Архивировать
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    <h4 className="text-sm font-semibold line-clamp-2 leading-tight" title={property.residentialComplex}>
                        {property.residentialComplex}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate" title={property.address}>
                        {property.address}
                    </p>
                </CardHeader>

                <CardContent className="p-3 pt-1 max-h-[40px] group-hover:max-h-[500px] overflow-hidden transition-all duration-300 ease-in-out">
                    {/* COVER IMAGE */}
                    {property.images && property.images.length > 0 && !imgError ? (
                        <div className="mb-2 -mx-3 -mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={property.images[0]}
                                alt="Cover"
                                className="w-full h-32 object-cover"
                                onError={() => setImgError(true)}
                            />
                        </div>
                    ) : (property.images && property.images.length > 0 && imgError) && (
                        <div className="mb-2 -mx-3 -mt-2 h-32 bg-[#F0FAF5] flex items-center justify-center border-b">
                            <ImageOff className="h-8 w-8 text-[#2E7D5E]/30" />
                        </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-medium mb-2">
                        <span className="text-primary">{priceFormatted}</span>
                        <span className="text-muted-foreground">{property.area} м²</span>
                    </div>

                    {/* Индикаторы */}
                    <div className="flex gap-2 pt-2 border-t mt-2 items-center justify-between">
                        <div className="flex gap-2">
                            {property.liquidityScore < 50 && (
                                <div className="flex items-center gap-1 text-[10px] text-orange-600" title="Низкая ликвидность">
                                    <TrendingUp className="h-3 w-3 rotate-180" />
                                    <span>{property.liquidityScore}</span>
                                </div>
                            )}

                            {isCritical && (
                                <div className="flex items-center gap-1 text-[10px] text-destructive font-semibold">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Риск</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 z-20" onPointerDown={(e) => e.stopPropagation()}>
                            {/* Eye Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() => setSummaryOpen(true)}
                                title="Подробнее"
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* TradeIn Button */}
                            <TradeInButton property={property} />

                            {/* AI Button */}
                            {property.activeStrategy && (
                                property.strategyExplanation ? (
                                    <div className="text-[#2E7D5E] flex items-center px-1" title="Обоснование готово">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 hover:bg-[#FFD700]/10 hover:text-[#D4A843] transition-colors"
                                        onClick={handleGenerateStrategy}
                                        disabled={isGenerating}
                                        title="Сгенерировать обоснование AI"
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4A843]" />
                                        ) : (
                                            <Sparkles className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                )
                            )}
                        </div>
                    </div>

                    {property.seller && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <HandCoins className="h-3 w-3" />
                            <span>{property.seller.firstName} {property.seller.lastName}</span>
                        </div>
                    )}

                    {/* ADMIN ONLY: Broker Info */}
                    {user?.role === 'ADMIN' && property.broker && (
                        <div className="mt-2 pt-2 border-t flex items-center gap-1 text-[10px] text-muted-foreground justify-between">
                            <span className="opacity-70">Брокер:</span>
                            <div className="flex items-center gap-1 font-medium text-foreground">
                                <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px] bg-[#2E7D5E]/10 text-[#2E7D5E]">
                                        {property.broker.firstName?.[0]}{property.broker.lastName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <span>{property.broker.firstName} {property.broker.lastName}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card >

            <SummaryDialog
                open={summaryOpen}
                onOpenChange={setSummaryOpen}
                data={property}
                type="Property"
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Архивировать объект?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Объект «{property.residentialComplex}» будет перемещён в архив.
                            Это действие можно отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(property.id);
                                setDeleteDialogOpen(false);
                            }}
                        >
                            Архивировать
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export function PropertyCard({ property, onDelete, onStageChange }: PropertyCardProps) {
    // Disable dragging for SOLD properties (check both funnelStage and status)
    const isSold = property.funnelStage === 'SOLD' || property.status === 'SOLD';

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: property.id,
        data: { type: "Property", item: property },
        animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
        disabled: isSold, // Lock sold properties from moving
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <PropertyCardBase
            property={property}
            style={style}
            setNodeRef={setNodeRef}
            attributes={isSold ? {} : attributes}
            listeners={isSold ? {} : listeners}
            isDragging={isDragging}
            isSold={isSold}
            onDelete={onDelete}
            onStageChange={onStageChange}
        />
    );
}
