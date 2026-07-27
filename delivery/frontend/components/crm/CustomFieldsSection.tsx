"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CustomField, CustomFieldType, CustomFieldEntity, CustomFieldValue, CustomStage } from "@/types/kanban";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CustomFieldsSectionProps {
    entityType: CustomFieldEntity;
    entityId: string;
    customFieldValues?: CustomFieldValue[];
    customStage?: CustomStage;
}

export function CustomFieldsSection({ entityType, entityId, customFieldValues = [], customStage }: CustomFieldsSectionProps) {
    const queryClient = useQueryClient();
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [updatingFieldId, setUpdatingFieldId] = useState<string | null>(null);

    // Initialize local values
    useEffect(() => {
        const initialValues: Record<string, string> = {};
        customFieldValues.forEach(v => {
            initialValues[v.fieldId] = v.value;
        });
        setLocalValues(initialValues);
    }, [customFieldValues]);

    // Fetch Fields
    const { data: fields = [], isLoading } = useQuery({
        queryKey: ["custom-fields", entityType],
        queryFn: async () => {
            const res = await api.get<CustomField[]>("/custom-fields");
            // Filter by entity type and active status
            return res.data.filter(f =>
                f.entityType === entityType &&
                f.isActive
            );
        },
    });

    // Filter fields based on funnel
    const relevantFields = fields.filter(f => {
        if (!f.funnelId) return true; // Global field
        if (customStage && f.funnelId === customStage.funnelId) return true; // Matches current funnel
        return false;
    });

    const mutation = useMutation({
        mutationFn: async (data: { fieldId: string, value: string }) => {
            setUpdatingFieldId(data.fieldId);
            const endpoint = entityType === CustomFieldEntity.SELLER ? `/sellers/${entityId}` : `/crm-properties/${entityId}`;

            // Construct the payload. 
            // NOTE: The backend expects 'customFields' object with fieldName/fieldId keys? 
            // Or 'customFields' as array?
            // Checking backend: PUT logic extracts 'customFields' from body.
            // It expects a map of { [fieldId]: value }.

            const payload = {
                customFields: {
                    [data.fieldId]: data.value
                }
            };

            return api.put(endpoint, payload);
        },
        onSuccess: (_, variables) => {
            // Invalidate parent query to refresh data
            const queryKey = entityType === CustomFieldEntity.SELLER ? ["seller", entityId] : ["property", entityId];
            queryClient.invalidateQueries({ queryKey });
            toast.success("Сохранено");
            setUpdatingFieldId(null);
        },
        onError: () => {
            toast.error("Ошибка сохранения");
            setUpdatingFieldId(null);
        }
    });

    const handleValueChange = (fieldId: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleSave = (fieldId: string, value: string) => {
        // Only save if changed? or always save on blur
        // Check against original?
        // For simplicity, save.
        mutation.mutate({ fieldId, value });
    };

    if (isLoading) return <div className="space-y-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
    if (relevantFields.length === 0) return null;

    return (
        <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
                Дополнительные поля
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relevantFields.map(field => {
                    const value = localValues[field.id] || "";
                    const isUpdating = updatingFieldId === field.id;

                    return (
                        <div key={field.id} className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                                {field.name}
                                {isUpdating && <Loader2 className="ml-2 h-3 w-3 inline animate-spin" />}
                            </Label>

                            {field.type === CustomFieldType.TEXT && (
                                <Input
                                    value={value}
                                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                                    onBlur={(e) => handleSave(field.id, e.target.value)}
                                    className="h-9"
                                />
                            )}

                            {field.type === CustomFieldType.NUMBER && (
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                                    onBlur={(e) => handleSave(field.id, e.target.value)}
                                    className="h-9"
                                />
                            )}

                            {field.type === CustomFieldType.DATE && (
                                <Input
                                    type="date"
                                    value={value}
                                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                                    onBlur={(e) => handleSave(field.id, e.target.value)}
                                    className="h-9"
                                />
                            )}

                            {field.type === CustomFieldType.TEXTAREA && (
                                <Textarea
                                    value={value}
                                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                                    onBlur={(e) => handleSave(field.id, e.target.value)}
                                    className="resize-none min-h-[80px]"
                                />
                            )}

                            {field.type === CustomFieldType.SELECT && (
                                <Select
                                    value={value}
                                    onValueChange={(val) => {
                                        handleValueChange(field.id, val);
                                        handleSave(field.id, val);
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {field.options.map((opt, idx) => (
                                            <SelectItem key={idx} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {field.type === CustomFieldType.CHECKBOX && (
                                <div className="flex items-center space-x-2 h-9">
                                    <Checkbox
                                        id={field.id}
                                        checked={value === "true"}
                                        onCheckedChange={(checked) => {
                                            const val = checked ? "true" : "false";
                                            handleValueChange(field.id, val);
                                            handleSave(field.id, val);
                                        }}
                                    />
                                    <label
                                        htmlFor={field.id}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        {value === "true" ? "Да" : "Нет"}
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
