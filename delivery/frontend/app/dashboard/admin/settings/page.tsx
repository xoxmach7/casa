"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api-client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Brain, Save, Loader2, Key, CheckCircle2, XCircle } from "lucide-react";

interface Setting {
    key: string;
    value: string;
    description?: string;
}

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const [keys, setKeys] = useState<{ [key: string]: string }>({});

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings"],
        queryFn: async () => {
            const res = await api.get<Setting[]>("/admin/settings");
            return res.data;
        }
    });

    const mutation = useMutation({
        mutationFn: async (data: { key: string; value: string }) => {
            return api.post("/admin/settings", data);
        },
        onSuccess: () => {
            toast.success("Ключ успешно сохранен");
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            setKeys({}); // Clear local state to show saved value
        },
        onError: () => toast.error("Ошибка сохранения")
    });

    const handleSave = (key: string) => {
        const value = keys[key];
        if (value === undefined) return;
        mutation.mutate({ key, value });
    };

    const getDisplayValue = (key: string) => {
        // If user is typing, show their input
        if (keys[key] !== undefined) return keys[key];
        // Otherwise show existing value (masked by password input)
        const serverVal = settings?.find(s => s.key === key)?.value;
        return serverVal || "";
    };

    const isConfigured = (key: string) => {
        return settings?.some(s => s.key === key && s.value && s.value.length > 0);
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    const sections = [
        {
            title: "DeepSeek API",
            key: "DEEPSEEK_API_KEY",
            desc: "Основной движок. Используется для генерации аналитики и стратегий продаж.",
            icon: <Brain className="h-5 w-5 text-white" />,
            color: "bg-indigo-500"
        },
        {
            title: "OpenAI API",
            key: "OPENAI_API_KEY",
            desc: "Резервный провайдер. Используется как запасной вариант (опционально).",
            icon: <Key className="h-5 w-5 text-white" />,
            color: "bg-emerald-500"
        }
    ];

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Настройки AI</h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Управление подключением к нейросетям. Ключи сохраняются в защищенную базу данных.
                </p>
            </div>

            <div className="grid gap-6">
                {sections.map((section) => {
                    const active = isConfigured(section.key);
                    const hasChanges = keys[section.key] !== undefined && keys[section.key] !== (settings?.find(s => s.key === section.key)?.value || "");

                    return (
                        <Card key={section.key} className={active ? "border-green-200/50 bg-green-50/10" : "border-muted"}>
                            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-6">
                                <div className={`p-3 rounded-xl shadow-sm ${section.color}`}>
                                    {section.icon}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl">{section.title}</CardTitle>
                                        {active ? (
                                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 gap-1.5 py-1 px-3">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Подключено
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 gap-1.5 py-1 px-3">
                                                <XCircle className="h-3.5 w-3.5" />
                                                Не настроено
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="text-base">
                                        {section.desc}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={section.key}>API Key</Label>
                                        <div className="flex gap-3">
                                            <Input
                                                id={section.key}
                                                type="password"
                                                placeholder={active ? "••••••••••••••••••••" : "sk-..."}
                                                value={getDisplayValue(section.key)}
                                                onChange={(e) => setKeys(prev => ({ ...prev, [section.key]: e.target.value }))}
                                                className="font-mono text-sm h-11"
                                            />
                                            <Button
                                                onClick={() => handleSave(section.key)}
                                                disabled={mutation.isPending || !hasChanges}
                                                className="h-11 px-6 font-medium"
                                                variant={hasChanges ? "default" : "secondary"}
                                            >
                                                {mutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                Сохранить
                                            </Button>
                                        </div>
                                    </div>
                                    {active && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
                                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            <span>
                                                Ключ сохранен в базе данных и используется системой.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
