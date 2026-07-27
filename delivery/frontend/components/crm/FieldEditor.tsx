"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CustomField, CustomFieldType, CustomFieldEntity } from "@/types/kanban";
import { Loader2, Plus, Trash2 } from "lucide-react";

const fieldSchema = z.object({
    name: z.string().min(1, "Название обязательно"),
    type: z.nativeEnum(CustomFieldType),
    entityType: z.nativeEnum(CustomFieldEntity),
    funnelId: z.string().optional().nullable(),
    options: z.string().optional(),
    isActive: z.boolean(),
});

type FieldFormValues = z.infer<typeof fieldSchema>;

interface FieldEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fieldToEdit?: CustomField | null;
    funnels?: { id: string; name: string }[];
}

export function FieldEditor({ open, onOpenChange, fieldToEdit, funnels = [] }: FieldEditorProps) {
    const queryClient = useQueryClient();

    const form = useForm<FieldFormValues>({
        resolver: zodResolver(fieldSchema),
        defaultValues: {
            name: "",
            type: CustomFieldType.TEXT,
            entityType: CustomFieldEntity.SELLER,
            funnelId: "all", // "all" logic internally handled
            options: "",
            isActive: true,
        },
    });

    // Reset form when opening or editing different field
    useEffect(() => {
        if (open) {
            if (fieldToEdit) {
                form.reset({
                    name: fieldToEdit.name,
                    type: fieldToEdit.type,
                    entityType: fieldToEdit.entityType,
                    funnelId: fieldToEdit.funnelId || "all",
                    options: fieldToEdit.options.join(", "),
                    isActive: fieldToEdit.isActive,
                });
            } else {
                form.reset({
                    name: "",
                    type: CustomFieldType.TEXT,
                    entityType: CustomFieldEntity.SELLER,
                    funnelId: "all",
                    options: "",
                    isActive: true,
                });
            }
        }
    }, [open, fieldToEdit, form]);

    const mutation = useMutation({
        mutationFn: async (data: FieldFormValues) => {
            // Process options
            let optionsArray: string[] = [];
            if (typeof data.options === 'string') {
                optionsArray = data.options.split(',').map(s => s.trim()).filter(Boolean);
            } else if (Array.isArray(data.options)) {
                optionsArray = data.options;
            }

            const payload = {
                ...data,
                funnelId: data.funnelId === "all" ? null : data.funnelId,
                options: optionsArray,
            };

            if (fieldToEdit) {
                return api.put(`/custom-fields/${fieldToEdit.id}`, payload);
            } else {
                return api.post("/custom-fields", payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
            toast.success(fieldToEdit ? "Поле обновлено" : "Поле создано");
            onOpenChange(false);
        },
        onError: () => {
            toast.error("Ошибка сохранения поля");
        },
    });

    const onSubmit = (data: FieldFormValues) => {
        mutation.mutate(data);
    };

    const watchType = form.watch("type");

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{fieldToEdit ? "Редактировать поле" : "Новое поле"}</SheetTitle>
                    <SheetDescription>
                        Настройте пользовательское поле для карточек CRM.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Название поля</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Например: Бюджет, Дата заселения..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="entityType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Сущность</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Выберите сущность" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value={CustomFieldEntity.SELLER}>Продавец</SelectItem>
                                                <SelectItem value={CustomFieldEntity.PROPERTY}>Объект</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Тип данных</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Выберите тип" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value={CustomFieldType.TEXT}>Текст</SelectItem>
                                                <SelectItem value={CustomFieldType.NUMBER}>Число</SelectItem>
                                                <SelectItem value={CustomFieldType.DATE}>Дата</SelectItem>
                                                <SelectItem value={CustomFieldType.SELECT}>Выпадающий список</SelectItem>
                                                <SelectItem value={CustomFieldType.CHECKBOX}>Чекбокс</SelectItem>
                                                <SelectItem value={CustomFieldType.TEXTAREA}>Многострочный текст</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Funnel Selection (Optional) */}
                        <FormField
                            control={form.control}
                            name="funnelId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Привязка к воронке (опционально)</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value || "all"}
                                        defaultValue="all"
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Для всех воронок" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">Для всех воронок</SelectItem>
                                            {funnels.map((f) => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Если выбрано, поле будет отображаться только в этой воронке.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Options for SELECT/CHECKBOX */}
                        {(watchType === CustomFieldType.SELECT || watchType === CustomFieldType.CHECKBOX) && (
                            <FormField
                                control={form.control}
                                name="options"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Варианты (через запятую)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Да, Нет, Возможно..." {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormDescription>
                                            Укажите возможные значения, разделяя их запятой.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Активно</FormLabel>
                                        <FormDescription>
                                            Показывается ли поле в карточках
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

                        <SheetFooter >
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {fieldToEdit ? "Сохранить изменения" : "Создать поле"}
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
