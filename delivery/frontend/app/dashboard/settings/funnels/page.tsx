"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { CustomFunnel, CustomStage } from "@/types/kanban";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, GripVertical, AlertCircle } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FunnelEditor } from "@/components/crm/FunnelEditor";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function FunnelsPage() {
    const queryClient = useQueryClient();
    const [editorOpen, setEditorOpen] = useState(false);
    const [selectedFunnel, setSelectedFunnel] = useState<CustomFunnel | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const { data: funnels, isLoading, isError } = useQuery<CustomFunnel[]>({
        queryKey: ["custom-funnels"],
        queryFn: async () => {
            const response = await api.get("/custom-funnels");
            return response.data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/custom-funnels/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-funnels"] });
            toast.success("Воронка удалена");
            setDeleteId(null);
        },
        onError: () => {
            toast.error("Ошибка удаления");
        },
    });

    const handleCreate = () => {
        setSelectedFunnel(null);
        setEditorOpen(true);
    };

    const handleEdit = (funnel: CustomFunnel) => {
        setSelectedFunnel(funnel);
        setEditorOpen(true);
    };

    const handleDelete = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            deleteMutation.mutate(deleteId);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Воронки продаж</h1>
                    <p className="text-sm text-muted-foreground">
                        Настройте собственные воронки продаж и этапы сделок.
                    </p>
                </div>
                <Button onClick={handleCreate} className="bg-[#2E7D5E] hover:bg-[#256B4F] text-white shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Создать воронку
                </Button>
            </div>

            {isError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Ошибка</AlertTitle>
                    <AlertDescription>
                        Не удалось загрузить воронки. Пожалуйста, попробуйте позже.
                    </AlertDescription>
                </Alert>
            )}

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-4 w-1/3" />
                            <div className="flex gap-2">
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : funnels && funnels.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {funnels.map((funnel) => (
                        <div
                            key={funnel.id}
                            className="group rounded-xl border bg-card p-5 hover:shadow-md transition-all duration-200 cursor-pointer"
                            onClick={() => handleEdit(funnel)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-base">{funnel.name}</h3>
                                    <Badge
                                        variant={funnel.isActive ? "default" : "secondary"}
                                        className={`mt-1 text-[10px] ${funnel.isActive ? 'bg-[#2E7D5E]/10 text-[#2E7D5E] border-[#2E7D5E]/20' : ''}`}
                                    >
                                        {funnel.isActive ? "Активна" : "Скрыта"}
                                    </Badge>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => { e.stopPropagation(); handleEdit(funnel); }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(funnel.id); }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            {funnel.stages && funnel.stages.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {funnel.stages
                                        .sort((a, b) => a.order - b.order)
                                        .map((stage, idx) => (
                                            <div key={stage.id} className="flex items-center gap-1.5">
                                                <Badge
                                                    variant="outline"
                                                    style={{ borderColor: stage.color, color: stage.color, backgroundColor: `${stage.color}10` }}
                                                    className="text-[11px] font-medium"
                                                >
                                                    {stage.name}
                                                </Badge>
                                                {idx < funnel.stages.length - 1 && (
                                                    <span className="text-muted-foreground/40 text-xs">→</span>
                                                )}
                                            </div>
                                        ))
                                    }
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">Нет этапов</p>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-3">
                                {funnel.stages?.length || 0} этапов
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border-2 border-dashed bg-muted/30 flex flex-col items-center justify-center py-16">
                    <div className="h-12 w-12 rounded-full bg-[#2E7D5E]/10 flex items-center justify-center mb-4">
                        <Plus className="h-6 w-6 text-[#2E7D5E]" />
                    </div>
                    <p className="text-muted-foreground font-medium mb-1">Нет созданных воронок</p>
                    <p className="text-xs text-muted-foreground mb-4">Создайте первую воронку для управления сделками</p>
                    <Button onClick={handleCreate} variant="outline" size="sm">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Создать воронку
                    </Button>
                </div>
            )}

            <FunnelEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                funnel={selectedFunnel}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Это действие нельзя отменить. Воронка будет удалена навсегда вместе со всеми этапами.
                            Связанные сделки могут потерять привязку к этапам.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={confirmDelete}
                        >
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
