"use client";

import { useState, useEffect } from "react"; // Added useEffect
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    MouseSensor,
    DragStartEvent,
    DragEndEvent,
    TouchSensor,
    closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SellerCard, SellerCardBase } from "./SellerCard";
import { PropertyCard, PropertyCardBase } from "./PropertyCard";
import { KanbanColumn } from "./KanbanColumn";
import { Seller, CrmProperty, SellerFunnelStage, PropertyFunnelStage } from "@/types/kanban";
import { createPortal } from "react-dom";
import { MissingDataDialog } from "./dialogs/MissingDataDialog";
import { ChecklistDialog } from "./dialogs/ChecklistDialog";
import { MediaGatewayDialog } from "./dialogs/MediaGatewayDialog";
import { RefusalDialog, CancellationReason } from "./dialogs/RefusalDialog";
import { toast } from "sonner";
import { StrategyLoader } from "./StrategyLoader";
import { StrategySelectDialog } from "./dialogs/StrategySelectDialog";
import { AiStrategyConfirmDialog } from "./dialogs/AiStrategyConfirmDialog";
import { StrategiesSheet } from "./sheets/StrategiesSheet";
import api from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreateSellerForm } from "./forms/CreateSellerForm";
import { CreatePropertyForm } from "./forms/CreatePropertyForm";
import { Target, LayoutGrid, List as ListIcon } from "lucide-react"; // Added Icons
import { PropertiesTableView } from "./PropertiesTableView"; // NEW IMPORT

type KanbanItem =
    | { type: "Seller"; item: Seller }
    | { type: "Property"; item: CrmProperty };

const STAGE_DESCRIPTIONS: Record<string, string> = {
    [SellerFunnelStage.CONTACT]: "Новые заявки. Только имя и телефон.\nСбор к.д, первичное касание.",
    [SellerFunnelStage.INTERVIEW]: "Сбор детальной информации: причина, сроки, финансы.\nЗаполнение анкеты.",
    [SellerFunnelStage.STRATEGY]: "Анализ AI и выбор стратегии продажи.\nАвтоматический подбор условий.",
    [SellerFunnelStage.CONTRACT_SIGNING]: "Подписание договора и начало работы.\nОфициальное закрепление.",
    [PropertyFunnelStage.PREPARATION]: "Подготовка объекта к продаже (Фото, Клининг).",
    [PropertyFunnelStage.LEADS]: "Активное продвижение и сбор заявок.",
    [PropertyFunnelStage.SHOWS]: "Организация и проведение показов.",
    [PropertyFunnelStage.DEAL]: "Обсуждение условий и оформление сделки.",
    [PropertyFunnelStage.SOLD]: "Сделка закрыта. Объект продан.",
    [SellerFunnelStage.CANCELLED]: "Клиент отказался / Объект не продан."
};

interface KanbanBoardProps {
    type: "sellers" | "properties";
    columns: readonly { id: string; title: string; variant?: "blue" | "pink" | "green" | "cyan" | "default"; color?: string }[];
    items: Record<string, (Seller | CrmProperty)[]>;
    onDragEnd: (id: string, newStage: string) => void;
    onAddProperty?: (sellerId: string) => void;
    onEditProperty?: (property: CrmProperty) => void;
    isCustom?: boolean;
    strategiesOpen?: boolean;
    onStrategiesOpenChange?: (open: boolean) => void;
}

export function KanbanBoard({ type, columns, items, onDragEnd, onAddProperty, onEditProperty, isCustom = false, strategiesOpen: externalStrategiesOpen, onStrategiesOpenChange }: KanbanBoardProps) {
    const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem("user");
        if (userData) {
            try {
                const user = JSON.parse(userData);
                setUserRole(user.role);
            } catch (e) {
                console.error("Error parsing user data", e);
            }
        }
    }, []);

    // Strategies Sheet State
    const [strategiesSheetOpen, setStrategiesSheetOpen] = useState(false);

    // Sync external strategies open
    useEffect(() => {
        if (externalStrategiesOpen !== undefined) {
            setStrategiesSheetOpen(externalStrategiesOpen);
        }
    }, [externalStrategiesOpen]);

    const handleStrategiesOpenChange = (open: boolean) => {
        setStrategiesSheetOpen(open);
        onStrategiesOpenChange?.(open);
    };

    // AI Dialog State
    const [aiParams, setAiParams] = useState<{
        open: boolean;
        strategyCode: string | null;
        explanation: string | null;
    }>({ open: false, strategyCode: null, explanation: null });

    // Strategy Dialog State
    const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);

    // Form Control State
    const [isSellerFormOpen, setIsSellerFormOpen] = useState(false);
    const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
    const [selectedSellerId, setSelectedSellerId] = useState<string>("");
    const [selectedSellerData, setSelectedSellerData] = useState<any>(null); // For Edit Mode

    // Validation State
    const [missingDataOpen, setMissingDataOpen] = useState(false);
    const [missingDataMode, setMissingDataMode] = useState<"INTERVIEW" | "STRATEGY">("STRATEGY"); // Default
    const [validationSellerId, setValidationSellerId] = useState<string | null>(null);
    const [validationProperties, setValidationProperties] = useState<any[]>([]);
    const [pendingStage, setPendingStage] = useState<string | null>(null);

    // Gate States
    const [mediaOpen, setMediaOpen] = useState(false);
    const [validationPropertyId, setValidationPropertyId] = useState<string | null>(null);
    const [currentImageCount, setCurrentImageCount] = useState(0);

    const [checklistOpen, setChecklistOpen] = useState(false);

    // Refusal Dialog State
    const [refusalDialogOpen, setRefusalDialogOpen] = useState(false);
    const [pendingRefusalId, setPendingRefusalId] = useState<string | null>(null);
    const [pendingRefusalType, setPendingRefusalType] = useState<"seller" | "property">("seller");
    const [pendingRefusalName, setPendingRefusalName] = useState<string>("");

    // AI Strategy State
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    // Delete mutations
    const deleteSellerMutation = useMutation({
        mutationFn: async (sellerId: string) => {
            await api.delete(`/sellers/${sellerId}`);
        },
        onSuccess: () => {
            toast.success("Продавец удалён");
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
        },
        onError: (error: any) => {
            const msg = error.response?.data?.error || error.message || "Ошибка удаления";
            toast.error(msg);
        }
    });

    const deletePropertyMutation = useMutation({
        mutationFn: async (propertyId: string) => {
            await api.delete(`/crm-properties/${propertyId}`);
        },
        onSuccess: () => {
            toast.success("Объект архивирован");
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            queryClient.invalidateQueries({ queryKey: ["properties"] });
        },
        onError: (error: any) => {
            const msg = error.response?.data?.error || error.message || "Ошибка удаления";
            toast.error(msg);
        }
    });

    const handleAddProperty = (sellerId: string) => {
        setSelectedSellerId(sellerId);
        setIsPropertyFormOpen(true);
    };

    const handleEditSeller = (seller: Seller) => {
        if (seller.funnelStage === SellerFunnelStage.CONTACT) {
            return;
        }

        setSelectedSellerId(seller.id);
        setSelectedSellerData(seller);
        setIsSellerFormOpen(true);
    };

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const data = active.data.current as KanbanItem;
        setActiveItem(data);
    };

    const analyzeStrategy = async (seller: Seller, stageToSet?: string | null) => {
        setIsAiAnalyzing(true);
        const loadingToast = toast.loading("AI анализирует объект...");

        try {
            const propertyId = seller.properties?.[0]?.id;

            if (!propertyId) {
                toast.dismiss(loadingToast);
                setIsAiAnalyzing(false);
                toast.error("Нет объекта недвижимости для анализа. Добавьте объект.");
                return;
            }

            const res = await api.post(`/crm-properties/${propertyId}/recalculate-strategy`);
            const { property } = res.data;
            const activeStrategy = property?.activeStrategy;
            const strategyExplanation = property?.strategyExplanation;

            toast.dismiss(loadingToast);
            setIsAiAnalyzing(false);

            if (!activeStrategy) {
                throw new Error("AI вернул пустую стратегию");
            }

            if (stageToSet) {
                setValidationSellerId(seller.id);
                setPendingStage(stageToSet);
            } else {
                setValidationSellerId(seller.id);
            }

            setAiParams({
                open: true,
                strategyCode: activeStrategy,
                explanation: strategyExplanation
            });

        } catch (err: any) {
            console.error(err);
            toast.dismiss(loadingToast);
            setIsAiAnalyzing(false);
            const msg = err.response?.data?.error || err.message || "Ошибка";
            toast.error(`Ошибка AI анализа: ${msg} (Попробуйте обновить страницу)`);
        }
    };

    const handleSellerFormSuccess = () => {
        setIsSellerFormOpen(false);
        queryClient.invalidateQueries({ queryKey: ["sellers"] });

        if (validationSellerId && pendingStage) {
            if (pendingStage === SellerFunnelStage.STRATEGY) {
                let seller = selectedSellerData;
                if (!seller) {
                    seller = Object.values(items).flat().find(s => s.id === validationSellerId) as Seller | null;
                }

                if (seller) {
                    analyzeStrategy(seller, pendingStage);
                    return;
                }
            }

            handleValidationSuccess();
            return;
        }

        if (selectedSellerData && selectedSellerData.funnelStage === SellerFunnelStage.STRATEGY) {
            analyzeStrategy(selectedSellerData);
        }

        setSelectedSellerData(null);
        setSelectedSellerId("");
    };

    const processStageChange = (itemId: string, newStage: string, itemData: KanbanItem) => {
        if (isCustom) {
            onDragEnd(itemId, newStage);
            toast.success("Статус обновлен");
            setActiveItem(null);
            return;
        }

        if (type === "sellers" && itemData.type === "Seller") {
            const seller = itemData.item as Seller;

            if (newStage === SellerFunnelStage.CANCELLED) {
                setPendingRefusalId(itemId);
                setPendingRefusalType("seller");
                setPendingRefusalName(`${seller.firstName} ${seller.lastName}`);
                setRefusalDialogOpen(true);
                setActiveItem(null);
                return;
            }

            const STAGE_ORDER = [
                SellerFunnelStage.CONTACT,
                SellerFunnelStage.INTERVIEW,
                SellerFunnelStage.STRATEGY,
                SellerFunnelStage.CONTRACT_SIGNING
            ];

            const currentIndex = STAGE_ORDER.indexOf(seller.funnelStage);
            const newIndex = STAGE_ORDER.indexOf(newStage as SellerFunnelStage);

            if (newIndex !== -1 && currentIndex !== -1 && newIndex < currentIndex) {
                toast.error("Возврат на предыдущий этап запрещен");
                setActiveItem(null);
                return;
            }

            if (newIndex !== -1 && currentIndex !== -1 && newIndex > currentIndex + 1) {
                toast.error("Нельзя перепрыгивать этапы воронки");
                setActiveItem(null);
                return;
            }

            if (newStage === SellerFunnelStage.INTERVIEW) {
                const isComplete = seller.reason && seller.deadline && seller.source;

                if (!isComplete) {
                    toast.info("Для перехода на этап Интервью необходимо заполнить данные", {
                        description: "Заполните анкету продавца",
                        duration: 4000
                    });

                    setValidationSellerId(seller.id);
                    setPendingStage(newStage);

                    setSelectedSellerId(seller.id);
                    setSelectedSellerData(seller);
                    setIsSellerFormOpen(true);

                    setActiveItem(null);
                    return;
                }
            }

            if (newStage === SellerFunnelStage.STRATEGY) {
                if (seller.funnelStage === SellerFunnelStage.STRATEGY) {
                    setActiveItem(null);
                    return;
                }

                const missingFields = [];
                if (!seller.reason) missingFields.push("Причина продажи");
                if (!seller.deadline) missingFields.push("Срочность");
                if (!seller.source) missingFields.push("Источник");

                if (missingFields.length > 0) {
                    toast.warning("Для стратегии нужны данные", {
                        description: `Заполните: ${missingFields.join(", ")}`,
                        duration: 5000
                    });

                    setValidationSellerId(seller.id);
                    setPendingStage(newStage);

                    setSelectedSellerId(seller.id);
                    setSelectedSellerData(seller);
                    setIsSellerFormOpen(true);

                    setActiveItem(null);
                    return;
                }

                if (!seller.properties || seller.properties.length === 0) {
                    toast.error("Нельзя перейти к Стратегии без объекта", {
                        description: "Добавьте объект недвижимости в карточке продавца."
                    });
                    setActiveItem(null);
                    return;
                }

                setActiveItem(null);
                analyzeStrategy(seller, newStage);
                return;
            }

            if (newStage === SellerFunnelStage.CONTRACT_SIGNING) {
                setValidationSellerId(seller.id);
                setPendingStage(newStage);
                setChecklistOpen(true);
                setActiveItem(null);
                return;
            }
        }

        if (type === "properties" && itemData.type === "Property") {
            const property = itemData.item as CrmProperty;

            if (newStage === PropertyFunnelStage.CANCELLED) {
                onDragEnd(itemId, newStage);
                toast.success("Статус обновлен");
                setActiveItem(null);
                return;
            }

            if (newStage === PropertyFunnelStage.PREPARATION) {
                const imgCount = property.images?.length || 0;
                if (imgCount < 3) {
                    setValidationSellerId(property.id);
                    setPendingStage(newStage);

                    setValidationPropertyId(property.id);
                    setCurrentImageCount(imgCount);
                    setMediaOpen(true);

                    setActiveItem(null);
                    return;
                }
            }
        }

        toast.success("Статус обновлен");
        onDragEnd(itemId, newStage);
        setActiveItem(null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveItem(null);
            return;
        }

        const itemId = active.id as string;
        const newStage = over.id as string;
        const itemData = active.data.current as KanbanItem;

        processStageChange(itemId, newStage, itemData);
    };

    const handleManualStageChange = (id: string, stage: string) => {
        let itemData: KanbanItem | null = null;
        Object.values(items).forEach(list => {
            if (itemData) return;
            const found = list.find(i => i.id === id);
            if (found) {
                if (type === "sellers") {
                    itemData = { type: "Seller", item: found as Seller };
                } else {
                    itemData = { type: "Property", item: found as CrmProperty };
                }
            }
        });

        if (itemData) {
            processStageChange(id, stage, itemData);
        }
    };

    const handleValidationSuccess = () => {
        if (validationSellerId && pendingStage) {
            onDragEnd(validationSellerId, pendingStage);
            setValidationSellerId(null);
            setPendingStage(null);
        }
    };

    const handleStrategySuccess = async (strategyConfig: string) => {
        try {
            if (!validationSellerId) return;

            let foundSeller: Seller | undefined;
            Object.values(items).forEach(list => {
                const s = (list as Seller[]).find(s => s.id === validationSellerId);
                if (s) foundSeller = s;
            });

            if (foundSeller && foundSeller.properties) {
                await Promise.all(foundSeller.properties.map(p =>
                    api.patch(`/crm-properties/${p.id}`, { activeStrategy: strategyConfig })
                ));
            }

            toast.success("Стратегия применена!");
            handleValidationSuccess();
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            queryClient.invalidateQueries({ queryKey: ["properties"] });

        } catch (error) {
            console.error("Strategy save error", error);
            toast.error("Не удалось сохранить стратегию");
            setStrategyDialogOpen(false);
        }
    };

    // Flatten items for List View
    const allProperties = type === "properties"
        ? Object.values(items).flat() as CrmProperty[]
        : [];

    // Sort logic ? 
    // Usually lists are sorted by date or name. We can add sorting logic inside PropertiesTableView.

    return (
        <div className="h-full flex flex-col">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                autoScroll={true}
            >

                <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto px-2 py-2 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {columns.map((col) => (
                        <KanbanColumn
                            key={col.id}
                            id={col.id}
                            title={col.title}
                            count={items[col.id]?.length || 0}
                            description={STAGE_DESCRIPTIONS[col.id]}
                            variant={(col as any).variant || 'default'}
                        >
                            <SortableContext
                                items={items[col.id]?.map((i) => i.id) || []}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="flex flex-col gap-3 min-h-[50px]">
                                    {items[col.id]?.map((item) => (
                                        <div key={item.id}>
                                            {type === "sellers" ? (
                                                <SellerCard
                                                    seller={item as Seller}
                                                    onAddProperty={onAddProperty}
                                                    onInterviewClick={() => handleEditSeller(item as Seller)}
                                                    onDelete={(id) => deleteSellerMutation.mutate(id)}
                                                    onStageChange={handleManualStageChange}
                                                />
                                            ) : (
                                                <PropertyCard
                                                    property={item as CrmProperty}
                                                    onDelete={(id: string) => deletePropertyMutation.mutate(id)}
                                                    onStageChange={handleManualStageChange}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>
                        </KanbanColumn>
                    ))}
                </div>

                {
                    typeof window !== "undefined" && createPortal(
                        <DragOverlay dropAnimation={{
                            duration: 150,
                            easing: 'ease-out',
                        }}>
                            {activeItem ? (
                                <div className="opacity-95 shadow-lg">
                                {activeItem.type === "Seller" ? (
                                    <SellerCardBase seller={activeItem.item as Seller} isOverlay />
                                ) : (
                                    <PropertyCardBase property={activeItem.item as CrmProperty} isOverlay />
                                )}
                                </div>
                            ) : null}
                        </DragOverlay>,
                        document.body
                    )
                }
            </DndContext >

            <MissingDataDialog
                open={missingDataOpen}
                onOpenChange={setMissingDataOpen}
                sellerId={validationSellerId || ""}
                mode={missingDataMode}
                properties={validationProperties}
                onSuccess={handleValidationSuccess}
            />

            <MediaGatewayDialog
                open={mediaOpen}
                onOpenChange={setMediaOpen}
                propertyId={validationPropertyId || ""}
                imageCount={currentImageCount}
                onSuccess={handleValidationSuccess}
            />

            <ChecklistDialog
                open={checklistOpen}
                onOpenChange={setChecklistOpen}
                title="Подписание Договора"
                items={[
                    "Договор подписан клиентом",
                    "Скан-копия загружена в систему",
                    "Оригинал получен в офис"
                ]}
                onSuccess={handleValidationSuccess}
            />

            <StrategySelectDialog
                open={strategyDialogOpen}
                onOpenChange={setStrategyDialogOpen}
                sellerId={validationSellerId || ""}
                onSuccess={handleStrategySuccess}
            />

            <AiStrategyConfirmDialog
                open={aiParams.open}
                onOpenChange={(v) => setAiParams(prev => ({ ...prev, open: v }))}
                strategyCode={aiParams.strategyCode}
                explanation={aiParams.explanation}
                onConfirm={() => {
                    setAiParams(prev => ({ ...prev, open: false }));
                    toast.success("Стратегия подтверждена!");
                    handleValidationSuccess();
                    queryClient.invalidateQueries({ queryKey: ["sellers"] });
                    queryClient.invalidateQueries({ queryKey: ["properties"] });
                }}
                onChange={() => {
                    setAiParams(prev => ({ ...prev, open: false }));
                    setStrategyDialogOpen(true); // Open manual select
                }}
            />

            <StrategiesSheet
                open={strategiesSheetOpen}
                onOpenChange={handleStrategiesOpenChange}
            />

            {/* AI Magic Overlay */}
            {
                isAiAnalyzing && createPortal(
                    <StrategyLoader />,
                    document.body
                )
            }

            {/* Forms */}
            <CreateSellerForm
                open={isSellerFormOpen}
                onOpenChange={(v) => {
                    setIsSellerFormOpen(v);
                    if (!v) {
                        setSelectedSellerData(null); // Reset on close
                        setSelectedSellerId("");
                    }
                }}
                initialData={selectedSellerData}
                onSuccess={handleSellerFormSuccess}
            />

            <CreatePropertyForm
                open={isPropertyFormOpen}
                onOpenChange={setIsPropertyFormOpen}
                sellerId={selectedSellerId}
            />

            {/* Refusal Dialog */}
            <RefusalDialog
                open={refusalDialogOpen}
                onOpenChange={(v) => {
                    setRefusalDialogOpen(v);
                    if (!v) {
                        setPendingRefusalId(null);
                        setPendingRefusalName("");
                    }
                }}
                itemType={pendingRefusalType}
                itemName={pendingRefusalName}
                onConfirm={async (reason, comment) => {
                    if (!pendingRefusalId) return;

                    try {
                        const endpoint = pendingRefusalType === "seller"
                            ? `/sellers/${pendingRefusalId}/stage`
                            : `/crm-properties/${pendingRefusalId}/stage`;

                        await api.put(endpoint, {
                            funnelStage: pendingRefusalType === "seller"
                                ? SellerFunnelStage.CANCELLED
                                : PropertyFunnelStage.CANCELLED,
                            cancellationReason: reason,
                            cancellationComment: comment
                        });

                        toast.success("Статус изменен на 'Отказ'");
                        queryClient.invalidateQueries({ queryKey: ["sellers"] });
                        queryClient.invalidateQueries({ queryKey: ["properties"] });

                    } catch (error: any) {
                        const msg = error.response?.data?.error || error.message || "Ошибка";
                        toast.error(`Ошибка: ${msg}`);
                    }

                    setRefusalDialogOpen(false);
                    setPendingRefusalId(null);
                    setPendingRefusalName("");
                }}
            />
        </div >
    );
}
