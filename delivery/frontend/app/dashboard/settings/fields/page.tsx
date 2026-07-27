"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FieldEditor } from "@/components/crm/FieldEditor";
import { CustomField, CustomFieldType, CustomFieldEntity } from "@/types/kanban";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function CustomFieldsPage() {
    const queryClient = useQueryClient();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);
    const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

    // Fetch Fields
    const { data: fields = [], isLoading: fieldsLoading } = useQuery({
        queryKey: ["custom-fields"],
        queryFn: async () => {
            const res = await api.get<CustomField[]>("/custom-fields");
            return res.data;
        },
    });

    // Fetch Funnels (for filtering options in editor)
    const { data: funnels = [] } = useQuery({
        queryKey: ["custom-funnels"],
        queryFn: async () => {
            const res = await api.get("/custom-funnels");
            return res.data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/custom-fields/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
            toast.success("Поле удалено");
            setDeleteFieldId(null);
        },
        onError: () => {
            toast.error("Ошибка удаления поля");
        },
    });

    // Determine funnel name helper
    const getFunnelName = (funnelId?: string | null) => {
        if (!funnelId) return "Все воронки";
        const funnel = funnels.find((f: any) => f.id === funnelId);
        return funnel ? funnel.name : "Неизвестная воронка";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Пользовательские поля</h2>
                    <p className="text-sm text-muted-foreground">
                        Настройте дополнительные поля для карточек продавцов и объектов.
                    </p>
                </div>
                <Button onClick={() => {
                    setEditingField(null);
                    setEditorOpen(true);
                }} className="bg-[#2E7D5E] hover:bg-[#256B4F] text-white shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить поле
                </Button>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Название</TableHead>
                            <TableHead className="font-semibold">Сущность</TableHead>
                            <TableHead className="font-semibold">Тип данных</TableHead>
                            <TableHead className="font-semibold">Воронка</TableHead>
                            <TableHead className="font-semibold">Статус</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fieldsLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : fields.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                            <Plus className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <p className="text-muted-foreground">Нет добавленных полей</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            fields.map((field: CustomField) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium">{field.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {field.entityType === CustomFieldEntity.SELLER ? "Продавец" : "Объект"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal">
                                            {field.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {getFunnelName(field.funnelId)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={field.isActive ? "default" : "secondary"}
                                            className={field.isActive ? "bg-[#2E7D5E]/15 text-[#2E7D5E] hover:bg-[#2E7D5E]/20 border-0" : ""}
                                        >
                                            {field.isActive ? "Активно" : "Скрыто"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setEditingField(field);
                                                        setEditorOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Редактировать
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600"
                                                    onClick={() => setDeleteFieldId(field.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Удалить
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <FieldEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                fieldToEdit={editingField}
                funnels={funnels}
            />

            <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Это действие нельзя отменить. Все значения этого поля будут удалены из всех карточек.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteFieldId && deleteMutation.mutate(deleteFieldId)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
