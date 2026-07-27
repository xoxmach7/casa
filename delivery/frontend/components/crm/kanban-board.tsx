"use client";

import { CloseDealDialog } from "./forms/CloseDealDialog";
import { KanbanBoard as DndBoard } from "./KanbanBoard";
import { SellersListView } from "./SellersListView";
import { PropertiesListView } from "./PropertiesListView";
import { CreateSellerForm } from "./forms/CreateSellerForm";
import { CreatePropertyForm } from "./forms/CreatePropertyForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Settings, LayoutGrid, List, Target } from "lucide-react";
import {
    SellerFunnelStage,
    PropertyFunnelStage,
    Seller,
    CrmProperty,
    CRMMode,
    CustomFunnel,
} from "@/types/kanban";
import { toast } from "sonner";
import { DateFilter } from "./DateFilter";
import { BrokerFilter } from "./BrokerFilter";
import { FormLinksButton } from "./FormLinksButton";
import { isSameMonth, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

// Columns Configuration (Standard)
const SELLER_COLUMNS = [
    { id: SellerFunnelStage.CONTACT, title: "Контакт", variant: "blue" },
    { id: SellerFunnelStage.INTERVIEW, title: "Интервью", variant: "pink" },
    { id: SellerFunnelStage.STRATEGY, title: "Стратегия", variant: "green" },
    { id: SellerFunnelStage.CONTRACT_SIGNING, title: "Договор", variant: "cyan" },
    { id: SellerFunnelStage.CANCELLED, title: "Отмена", variant: "default" },
] as const;

const PROPERTY_COLUMNS = [
    { id: PropertyFunnelStage.CREATED, title: "Создан", variant: "default" },
    { id: PropertyFunnelStage.PREPARATION, title: "Подготовка", variant: "pink" },
    { id: PropertyFunnelStage.LEADS, title: "Лиды", variant: "blue" },
    { id: PropertyFunnelStage.SHOWS, title: "Показы", variant: "cyan" },
    { id: PropertyFunnelStage.DEAL, title: "Сделка", variant: "green" },
    { id: PropertyFunnelStage.SOLD, title: "Продано", variant: "green" },
    { id: PropertyFunnelStage.CANCELLED, title: "Отмена", variant: "default" },
] as const;

/* CRM Skeleton */
function CrmSkeleton() {
    return (
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-[272px] shrink-0 rounded-xl overflow-hidden">
                    <Skeleton className="h-9 w-full rounded-b-none" />
                    <div className="bg-[#F0FAF5] p-2 space-y-2 min-h-[300px]">
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function KanbanBoard() {
    const [activeTab, setActiveTab] = useState<"sellers" | "properties">("sellers");
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [isSellerFormOpen, setIsSellerFormOpen] = useState(false);
    const [monthFilter, setMonthFilter] = useState<Date | undefined>(undefined);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
    const [strategiesOpen, setStrategiesOpen] = useState(false);
    const [brokerFilter, setBrokerFilter] = useState<string | undefined>(undefined);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>("");

    // Edit Seller State
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

    const handleEditSeller = (seller: Seller) => {
        setSelectedSeller(seller);
        setIsSellerFormOpen(true);
    };

    // Hybrid CRM State
    const [crmMode, setCrmMode] = useState<CRMMode>("STANDARD");
    const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setUserRole(user.role);
                setUserId(user.id);

                // Determine Mode
                if (['DEVELOPER', 'AGENCY', 'REALTOR'].includes(user.role)) {
                    setCrmMode("CUSTOM");
                } else {
                    setCrmMode("STANDARD");
                }
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
    }, []);

    // Property creation state
    const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
    const [selectedSellerId, setSelectedSellerId] = useState<string>("");
    // Edit Property State
    const [selectedProperty, setSelectedProperty] = useState<CrmProperty | null>(null);

    // Deal Closing State
    const [isCloseDealOpen, setIsCloseDealOpen] = useState(false);
    const [propertyConfigToClose, setPropertyConfigToClose] = useState<{ id: string, stage: string } | null>(null);

    const queryClient = useQueryClient();

    // --- CUSTOM FUNNELS DATA ---
    const { data: customFunnels, isLoading: isLoadingFunnels } = useQuery({
        queryKey: ["custom-funnels"],
        queryFn: async () => {
            const res = await api.get("/custom-funnels");
            return res.data as CustomFunnel[];
        },
        enabled: crmMode === "CUSTOM",
    });

    // Set active funnel default
    useEffect(() => {
        if (customFunnels && customFunnels.length > 0 && !activeFunnelId) {
            const active = customFunnels.find(f => f.isActive) || customFunnels[0];
            setActiveFunnelId(active.id);
        }
    }, [customFunnels, activeFunnelId]);

    const activeFunnel = customFunnels?.find(f => f.id === activeFunnelId);

    // --- SELLERS DATA ---
    const { data: sellersData, isLoading: isLoadingSellers } = useQuery({
        queryKey: ["sellers", brokerFilter, activeFunnelId], // Refetch on funnel change
        queryFn: async () => {
            const res = await api.get("/sellers", {
                params: { brokerId: brokerFilter }
            });
            return res.data;
        },
        enabled: activeTab === "sellers",
    });

    const updateSellerStageMutation = useMutation({
        mutationFn: async ({ id, stage, isCustom }: { id: string; stage: string, isCustom: boolean }) => {
            const payload = isCustom ? { customStageId: stage } : { funnelStage: stage };
            const res = await api.put(`/sellers/${id}/stage`, payload);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            queryClient.invalidateQueries({ queryKey: ["properties"] });

            if (data.activatedPropertiesCount && data.activatedPropertiesCount > 0) {
                toast.success(`Договор подписан! Активировано объектов: ${data.activatedPropertiesCount}`);
            } else {
                toast.success("Этап обновлён");
            }
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Ошибка обновления");
        },
    });

    // --- PROPERTIES DATA ---
    const { data: propertiesData, isLoading: isLoadingProperties } = useQuery({
        queryKey: ["properties", brokerFilter, activeFunnelId],
        queryFn: async () => {
            const res = await api.get("/crm-properties", {
                params: { brokerId: brokerFilter }
            });
            return res.data;
        },
        enabled: activeTab === "properties",
    });

    const updatePropertyStageMutation = useMutation({
        mutationFn: async ({ id, stage, isCustom }: { id: string; stage: string, isCustom: boolean }) => {
            const payload = isCustom ? { customStageId: stage } : { funnelStage: stage };
            return api.put(`/crm-properties/${id}/stage`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["properties"] });
            queryClient.invalidateQueries({ queryKey: ["sellers"] });
            toast.success("Этап обновлён");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Ошибка обновления");
        },
    });

    // --- FILTERING & GROUPING LOGIC ---
    const filterByDateRange = (items: any[]) => {
        if (!dateRange.from) return items;
        return items.filter(item => {
            if (!item.createdAt) return true;
            const d = parseISO(item.createdAt);
            if (dateRange.from && d < dateRange.from) return false;
            if (dateRange.to && d > dateRange.to) return false;
            return true;
        });
    };

    const sellersFiltered = filterByDateRange(sellersData?.sellers || []);
    const propertiesFiltered = filterByDateRange(propertiesData?.properties || []);

    // Helper to get stage ID (Standard vs Custom)
    const getStageId = (item: Seller | CrmProperty) => {
        if (crmMode === "CUSTOM") {
            return item.customStageId || "uncategorized"; // Handling unassigned items?
        }
        return item.funnelStage;
    };

    // Dynamic Columns Generation
    const getColumns = () => {
        if (crmMode === "CUSTOM") {
            if (!activeFunnel) return [];
            const cols = activeFunnel.stages.map(stage => ({
                id: stage.id,
                title: stage.name,
                color: stage.color,
                variant: 'default' as const
            }));
            // Add "uncategorized" column for items without a valid stage
            const stageIds = new Set(cols.map(c => c.id));
            const allItems = [...sellersFiltered, ...propertiesFiltered];
            const hasUncategorized = allItems.some(item => !item.customStageId || !stageIds.has(item.customStageId));
            if (hasUncategorized) {
                cols.unshift({ id: 'uncategorized', title: 'Без этапа', color: '#9CA3AF', variant: 'default' as const });
            }
            return cols;
        }
        return activeTab === "sellers" ? SELLER_COLUMNS : PROPERTY_COLUMNS;
    };

    const columns = getColumns();

    const sellersGrouped = sellersFiltered.reduce(
        (acc: Record<string, Seller[]>, seller: Seller) => {
            const stageId = getStageId(seller);
            if (!acc[stageId]) acc[stageId] = [];
            acc[stageId].push(seller);
            return acc;
        },
        {}
    );

    const propertiesGrouped = propertiesFiltered.reduce(
        (acc: Record<string, CrmProperty[]>, prop: CrmProperty) => {
            const stageId = getStageId(prop);
            if (!acc[stageId]) acc[stageId] = [];
            acc[stageId].push(prop);
            return acc;
        },
        {}
    );

    const handleAddProperty = (sellerId: string) => {
        setSelectedSellerId(sellerId);
        setIsPropertyFormOpen(true);
    };

    const handlePropertyDragEnd = (id: string, stage: string) => {
        // Special Deal Closing Logic (Only for Standard Mode?)
        // If Custom Mode has a stage named "DEAL", maybe we should trigger it too?
        // For now, let's keep Deal Closing Logic for Standard Mode OR if stage name strictly matches?
        // Actually, custom stages have IDs, not Enum names. So we can't easily match 'DEAL'.
        // We'll skip special logic for Custom Mode for now unless we add a "Stage Type" to custom stages.

        if (crmMode === "STANDARD" && stage === PropertyFunnelStage.DEAL) {
            setPropertyConfigToClose({ id, stage });
            setIsCloseDealOpen(true);
            return;
        }

        updatePropertyStageMutation.mutate({ id, stage, isCustom: crmMode === "CUSTOM" });
    };

    const isCustom = crmMode === "CUSTOM";

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Forms */}
            <CreateSellerForm
                open={isSellerFormOpen}
                onOpenChange={(v) => {
                    setIsSellerFormOpen(v);
                    if (!v) setSelectedSeller(null);
                }}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["sellers"] });
                    setIsSellerFormOpen(false);
                }}
                activeFunnelId={activeFunnelId}
                initialData={selectedSeller as any}
            />
            <CreatePropertyForm
                open={isPropertyFormOpen}
                onOpenChange={(v) => {
                    setIsPropertyFormOpen(v);
                    if (!v) setSelectedProperty(null);
                }}
                sellerId={selectedSellerId}
                initialData={selectedProperty as any}
            />
            {propertyConfigToClose && (
                <CloseDealDialog
                    open={isCloseDealOpen}
                    onOpenChange={setIsCloseDealOpen}
                    propertyId={propertyConfigToClose.id}
                    onSuccess={handleCloseDealSuccess}
                />
            )}

            {/* Control Panel */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-2.5 bg-background border-b shrink-0">
                <div className="flex items-center gap-2">
                    {!isCustom && (
                        <div className="flex bg-muted rounded-lg p-0.5">
                            <button
                                onClick={() => setActiveTab("sellers")}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    activeTab === "sellers"
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Продавцы
                            </button>
                            <button
                                onClick={() => setActiveTab("properties")}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    activeTab === "properties"
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Объекты
                            </button>
                        </div>
                    )}

                    {isCustom && (
                        <div className="flex items-center gap-2">
                            {isLoadingFunnels ? (
                                <Skeleton className="h-8 w-[180px]" />
                            ) : (
                                <Select value={activeFunnelId || ""} onValueChange={setActiveFunnelId}>
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                        <SelectValue placeholder="Выберите воронку" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customFunnels?.map(f => (
                                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Link href="/dashboard/settings/funnels">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Settings className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        </div>
                    )}

                    <div className="w-px h-5 bg-border mx-1" />

                    {/* View mode toggle */}
                    {!isCustom && (
                        <div className="flex bg-muted rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode("kanban")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    viewMode === "kanban"
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Канбан
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    viewMode === "list"
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <List className="h-3.5 w-3.5" />
                                Список
                            </button>
                        </div>
                    )}

                    <div className="w-px h-5 bg-border mx-1" />

                    {/* Strategies button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5 border-[#2E7D5E]/20 text-[#2E7D5E] hover:bg-[#2E7D5E]/5"
                        onClick={() => setStrategiesOpen(true)}
                    >
                        <Target className="h-3.5 w-3.5" />
                        Стратегии
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {userRole === "ADMIN" && (
                        <BrokerFilter
                            value={brokerFilter}
                            onChange={setBrokerFilter}
                            className="w-[160px]"
                        />
                    )}
                    {userRole === "BROKER" && userId && (
                        <FormLinksButton userId={userId} />
                    )}
                    <DateFilter dateRange={dateRange} setDateRange={setDateRange} />
                    {(activeTab === "sellers" || isCustom) && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => setIsSellerFormOpen(true)}>
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {isCustom ? "Новая сделка" : "Новый продавец"}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden bg-[#F5FAF7]">
                {isCustom && !activeFunnel ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                        <p>У вас еще нет воронок. Создайте свою первую воронку!</p>
                        <Link href="/dashboard/settings/funnels">
                            <Button>Создать воронку</Button>
                        </Link>
                    </div>
                ) : (
                    <>
                        {(activeTab === "sellers" || isCustom) ? (
                            isLoadingSellers ? (
                                <CrmSkeleton />
                            ) : viewMode === "list" ? (
                                <SellersListView
                                    onEdit={handleEditSeller}
                                    activeFunnelId={activeFunnelId}
                                />
                            ) : (
                                <DndBoard
                                    type="sellers"
                                    // @ts-ignore
                                    columns={columns}
                                    items={sellersGrouped}
                                    onAddProperty={handleAddProperty}
                                    isCustom={isCustom}
                                    strategiesOpen={strategiesOpen}
                                    onStrategiesOpenChange={setStrategiesOpen}
                                    onDragEnd={(id, stage) => {
                                        updateSellerStageMutation.mutate({ id, stage, isCustom });
                                    }}
                                />
                            )
                        ) : (
                            isLoadingProperties ? (
                                <CrmSkeleton />
                            ) : viewMode === "list" ? (
                                <PropertiesListView
                                    onEdit={(prop) => {
                                        setSelectedProperty(prop);
                                        setIsPropertyFormOpen(true);
                                    }}
                                    activeFunnelId={activeFunnelId}
                                />
                            ) : (
                                <DndBoard
                                    type="properties"
                                    // @ts-ignore
                                    columns={columns}
                                    items={propertiesGrouped}
                                    onDragEnd={handlePropertyDragEnd}
                                    isCustom={isCustom}
                                    strategiesOpen={strategiesOpen}
                                    onStrategiesOpenChange={setStrategiesOpen}
                                    onEditProperty={(prop: CrmProperty) => {
                                        setSelectedProperty(prop);
                                        setIsPropertyFormOpen(true);
                                    }}
                                />
                            )
                        )}
                    </>
                )}
            </div>
        </div >
    );

    function handleCloseDealSuccess() {
        setPropertyConfigToClose(null);
    }
}
