import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Star, FileText, Plus, MoreVertical, Trash2, ArrowRight } from "lucide-react";
import { Seller, SellerFunnelStage } from "@/types/kanban";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SellerCardProps {
    seller: Seller;
    onInterviewClick?: (id: string) => void;
    onAddProperty?: (id: string) => void;
    onDelete?: (id: string) => void;
    onStageChange?: (id: string, stage: SellerFunnelStage) => void;
}

import { defaultAnimateLayoutChanges } from "@dnd-kit/sortable";

import { useState } from "react";
import { Eye } from "lucide-react";
import { SummaryDialog } from "./dialogs/SummaryDialog";
import { DeadlineLabels, FunnelStageLabels } from "@/lib/translations";
import { useStrategy } from "@/lib/strategy-context";

export function SellerCardBase({ seller, onInterviewClick, onAddProperty, onDelete, onStageChange, style, setNodeRef, attributes, listeners, isDragging, isOverlay }: any) {
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [initialPropertyId, setInitialPropertyId] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const { getLabel } = useStrategy();

    // Load user for role check
    useState(() => {
        if (typeof window !== 'undefined') {
            const u = localStorage.getItem("user");
            if (u) setUser(JSON.parse(u));
        }
    });

    const trustLevelColor = "text-muted-foreground";

    return (
        <>
            <Card
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`mb-2 cursor-grab transition-all active:cursor-grabbing border group touch-action-none ${isOverlay ? "shadow-xl scale-105 rotate-2 cursor-grabbing" : ""} ${isDragging ? "opacity-50" : ""}`}
                onClick={() => onInterviewClick && onInterviewClick(seller.id)}
            >
                <CardHeader className="p-3 pb-1 flex flex-row justify-between items-start space-y-0 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-[#2E7D5E]/10 text-[#2E7D5E] text-[10px]">
                                {seller.firstName[0]}
                                {seller.lastName?.[0] || ''}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold leading-none truncate">
                                {seller.firstName} {seller.lastName}
                            </h4>
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                                <a href={`https://wa.me/${seller.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#2E7D5E] transition-colors truncate">
                                    <Phone className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{seller.phone}</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    className={`h-2.5 w-2.5 ${i < seller.trustLevel ? trustLevelColor : "text-gray-200"
                                        } fill-current`}
                                />
                            ))}
                        </div>
                        {/* Actions Menu - show for owner or admin */}
                        {(user?.role === 'ADMIN' || user?.id === seller.brokerId) && (
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
                                                    {Object.values(SellerFunnelStage).map((stage) => {
                                                        // Filter out current stage
                                                        if (stage === seller.funnelStage) return null;
                                                        if (stage === SellerFunnelStage.CANCELLED) return null; // Archive has separate button

                                                        return (
                                                            <DropdownMenuItem
                                                                key={stage}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onStageChange(seller.id, stage);
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

                                    {onDelete && (
                                        <DropdownMenuItem
                                            className="text-orange-600 focus:text-orange-600"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Архивировать
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 max-h-[60px] group-hover:max-h-[600px] overflow-hidden transition-all duration-300 ease-in-out">
                    {/* Status Badge */}
                    <div className="mb-3">
                        {seller.deadline ? (
                            <Badge variant="destructive" className="h-5 text-[10px] px-2 w-full justify-center">
                                Срочно: {DeadlineLabels[seller.deadline] || seller.deadline}
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="h-5 text-[10px] px-2 w-full justify-center text-muted-foreground bg-[#F0FAF5]">
                                Пассивный
                            </Badge>
                        )}
                    </div>

                    {/* Properties List */}
                    {seller.properties && seller.properties.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                            {seller.properties.slice(0, 3).map((p: any) => {
                                const isSold = p.funnelStage === 'SOLD' || p.status === 'SOLD';
                                return (
                                    <div
                                        key={p.id}
                                        className={`flex flex-col text-[10px] p-1.5 rounded border cursor-pointer transition-colors ${isSold
                                            ? 'bg-[#ECFDF5] border-[#2E7D5E]/20 hover:bg-[#D1FAE5]'
                                            : 'bg-[#F7FAFC] hover:bg-[#F0FAF5]'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInitialPropertyId(p.id);
                                            setSummaryOpen(true);
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`font-medium truncate max-w-[100px] ${isSold ? 'text-[#1B5E40]' : ''}`} title={p.residentialComplex}>
                                                {isSold && <span className="mr-1">✅</span>}
                                                {p.residentialComplex}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                                                    {p.showsCount > 0 && (
                                                        <span className="flex items-center" title="Показы">
                                                            <Eye className="h-3 w-3 mr-0.5" /> {p.showsCount}
                                                        </span>
                                                    )}
                                                    {p.leadsCount > 0 && (
                                                        <span className="flex items-center font-bold text-[#2E7D5E]" title="Офферы">
                                                            <FileText className="h-3 w-3 mr-0.5" /> {p.leadsCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant={isSold ? "default" : "outline"}
                                                    className={`text-[9px] h-4 px-1 ${isSold ? 'bg-[#2E7D5E] text-white' : 'bg-white'}`}
                                                    style={p.customStage ? { borderColor: p.customStage.color, color: p.customStage.color } : {}}
                                                >
                                                    {p.customStage?.name || FunnelStageLabels[p.funnelStage] || p.funnelStage}
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Show final price for SOLD properties */}
                                        {isSold && p.price && (
                                            <div className="text-[10px] font-bold text-[#1B5E40] mt-1">
                                                Продано: {Number(p.price).toLocaleString('ru-RU')} ₸
                                            </div>
                                        )}

                                        {/* AI Strategy Badge & Snippet (only for non-sold) */}
                                        {!isSold && p.activeStrategy && (
                                            <div className="mt-1 flex flex-col gap-1">
                                                <div className="flex items-center">
                                                    <Badge variant="secondary" className="w-fit text-[8px] h-3.5 px-1">
                                                        {getLabel(p.activeStrategy) || p.activeStrategy}
                                                    </Badge>
                                                </div>

                                                {p.strategyExplanation && (
                                                    <div className="text-[9px] text-muted-foreground leading-tight line-clamp-2 pl-1 border-l-2 border-border">
                                                        {(() => {
                                                            try {
                                                                const parsed = JSON.parse(p.strategyExplanation);
                                                                return parsed.reasoning || parsed.text || p.strategyExplanation;
                                                            } catch {
                                                                return p.strategyExplanation;
                                                            }
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {seller.properties.length > 3 && (
                                <div className="text-[10px] text-center text-muted-foreground">
                                    еще +{seller.properties.length - 3}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-[10px] text-muted-foreground text-center py-2 border border-dashed rounded mb-3">
                            Нет объектов
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-2">
                        <div className="text-[10px] text-muted-foreground">
                            Всего: {seller._count?.properties || 0}
                        </div>

                        <div className="flex gap-1 relative z-10">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary cursor-pointer"
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    console.log("Detail clicked");
                                    setInitialPropertyId(null); // Reset when clicking main details
                                    setSummaryOpen(true);
                                }}
                                title="Подробнее"
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 cursor-pointer"
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onAddProperty) {
                                        onAddProperty(seller.id);
                                    }
                                }}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Объект
                            </Button>
                        </div>
                    </div>

                    {/* ADMIN ONLY: Show Broker Name */}
                    {user?.role === 'ADMIN' && seller.broker && (
                        <div className="mt-2 pt-2 border-t flex items-center gap-1 text-[10px] text-muted-foreground justify-between">
                            <span className="opacity-70">Брокер:</span>
                            <div className="flex items-center gap-1 font-medium text-foreground">
                                <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px] bg-[#2E7D5E]/10 text-[#2E7D5E]">
                                        {seller.broker.firstName?.[0]}{seller.broker.lastName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <span>{seller.broker.firstName} {seller.broker.lastName}</span>
                            </div>
                        </div>
                    )}
                </CardContent >
            </Card >

            <SummaryDialog
                open={summaryOpen}
                onOpenChange={setSummaryOpen}
                data={seller}
                type="Seller"
                initialActivePropertyId={initialPropertyId}
            />

            {/* Archive Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Архивировать продавца?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Продавец {seller.firstName} {seller.lastName} будет перемещён в архив.
                            {seller.properties && seller.properties.length > 0 && (
                                <span className="block mt-2 text-orange-600 font-medium">
                                    У продавца есть {seller.properties.length} объект(ов). Они тоже будут архивированы.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-orange-500 text-white hover:bg-orange-600"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(seller.id);
                                setDeleteDialogOpen(false);
                            }}
                        >
                            Архивировать
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export function SellerCard(props: SellerCardProps) {
    // Check if seller has any SOLD properties - if so, disable dragging
    const hasSoldProperties = props.seller.properties?.some(
        (p: any) => p.funnelStage === 'SOLD' || p.status === 'SOLD'
    );

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: props.seller.id,
        data: { type: "Seller", item: props.seller },
        animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
        disabled: hasSoldProperties, // Lock sellers with sold properties from moving
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <SellerCardBase
            {...props}
            style={style}
            setNodeRef={setNodeRef}
            attributes={attributes}
            listeners={listeners}
            isDragging={isDragging}
        />
    );
}
