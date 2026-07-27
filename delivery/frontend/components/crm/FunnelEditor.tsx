"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { toast } from "sonner";
import { CustomFunnel, CustomStage } from "@/types/kanban";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";

// DnD Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Schema
const stageSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Название этапа обязательно"),
    color: z.string(),
    order: z.number(),
});

const funnelSchema = z.object({
    name: z.string().min(1, "Название воронки обязательно"),
    isActive: z.boolean(),
    stages: z.array(stageSchema),
});

type FunnelFormValues = z.infer<typeof funnelSchema>;

interface FunnelEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    funnel: CustomFunnel | null;
}

// Sortable Stage Item Component
function SortableStage({ id, index, remove, form }: { id: string, index: number, remove: (index: number) => void, form: any }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-2 bg-card p-2 rounded-md border min-h-[50px]">
            <div {...attributes} {...listeners} className="cursor-grab hover:text-primary p-1">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1 grid grid-cols-[1fr_auto] gap-2">
                <FormField
                    control={form.control}
                    name={`stages.${index}.name`}
                    render={({ field }) => (
                        <FormItem className="space-y-0">
                            <FormControl>
                                <Input {...field} placeholder="Название этапа" className="h-9" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`stages.${index}.color`}
                    render={({ field }) => (
                        <FormItem className="space-y-0">
                            <div className="flex items-center gap-2 h-9">
                                <FormControl>
                                    <Input {...field} type="color" className="h-9 w-12 p-1 cursor-pointer" />
                                </FormControl>
                            </div>
                        </FormItem>
                    )}
                />
            </div>

            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => remove(index)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}


export function FunnelEditor({ open, onOpenChange, funnel: funnelToEdit }: FunnelEditorProps) {
    const queryClient = useQueryClient();

    const form = useForm<FunnelFormValues>({
        resolver: zodResolver(funnelSchema),
        defaultValues: {
            name: "",
            isActive: true,
            stages: [],
        },
    });

    const { fields, append, remove, move } = useFieldArray({
        control: form.control,
        name: "stages",
    });

    useEffect(() => {
        if (open) {
            if (funnelToEdit) {
                form.reset({
                    name: funnelToEdit.name,
                    isActive: funnelToEdit.isActive ?? true,
                    stages: funnelToEdit.stages?.sort((a, b) => a.order - b.order).map(s => ({
                        id: s.id,
                        name: s.name,
                        color: s.color,
                        order: s.order
                    })) || [],
                });
            } else {
                form.reset({
                    name: "",
                    isActive: true,
                    stages: [
                        { name: "Новый", color: "#3B82F6", order: 0 },
                        { name: "В работе", color: "#F59E0B", order: 1 },
                        { name: "Закрыто", color: "#10B981", order: 2 }
                    ],
                });
            }
        }
    }, [open, funnelToEdit, form]);

    const mutation = useMutation({
        mutationFn: async (data: FunnelFormValues) => {
            // Re-order stages based on current array index
            const stagesWithOrder = data.stages.map((s, idx) => ({
                ...s,
                order: idx
            }));

            const payload = {
                ...data,
                stages: stagesWithOrder
            };

            if (funnelToEdit) {
                return api.put(`/custom-funnels/${funnelToEdit.id}`, payload);
            } else {
                return api.post("/custom-funnels", payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-funnels"] });
            toast.success(funnelToEdit ? "Воронка обновлена" : "Воронка создана");
            onOpenChange(false);
        },
        onError: (err) => {
            toast.error("Ошибка сохранения");
            console.error(err);
        },
    });

    const onSubmit = (data: FunnelFormValues) => {
        mutation.mutate(data);
    };

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex((item) => item.id === active.id);
            const newIndex = fields.findIndex((item) => item.id === over.id);
            move(oldIndex, newIndex);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] overflow-y-auto w-full">
                <SheetHeader>
                    <SheetTitle>{funnelToEdit ? "Редактировать воронку" : "Новая воронка"}</SheetTitle>
                    <SheetDescription>
                        Настройте этапы пользовательской воронки. Перетаскивайте этапы, чтобы изменить порядок.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4 pb-20">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Название воронки</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Например: Продажа вторички" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Активна</FormLabel>
                                        <FormDescription>
                                            Воронка будет доступна для выбора.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <FormLabel>Этапы воронки</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ name: "Новый этап", color: "#6B7280", order: fields.length })}
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Добавить
                                </Button>
                            </div>

                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={fields}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {fields.length > 0 ? (
                                            fields.map((field, index) => (
                                                <SortableStage
                                                    key={field.id}
                                                    id={field.id}
                                                    index={index}
                                                    remove={remove}
                                                    form={form}
                                                />
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                                                Нет этапов. Добавьте первый этап.
                                            </div>
                                        )}

                                    </div>
                                </SortableContext>
                            </DndContext>
                            {form.formState.errors.stages && (
                                <p className="text-sm font-medium text-destructive">
                                    {form.formState.errors.stages.message}
                                </p>
                            )}
                        </div>
                    </form>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t mt-auto">
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={mutation.isPending}
                            onClick={form.handleSubmit(onSubmit)}
                        >
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить изменения
                        </Button>
                    </div>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
