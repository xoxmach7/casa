"use client";

import { useState, useEffect, useCallback } from "react";
import { StrategyDescriptions } from "@/lib/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Info, Pencil, Plus, Trash2, Save, X } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api-client";

interface StrategyGridProps {
    selectedStrategy?: string | null;
    onSelect?: (strategy: string) => void;
    readOnly?: boolean;
}

type StrategyData = {
    code: string;
    name: string;
    type: string;
    description: string;
    applies: string[];
    goal: string;
    duration: string;
    tactics: string[];
};

type Overrides = Record<string, Partial<StrategyData>>;

export function StrategyGrid({ selectedStrategy, onSelect, readOnly = false }: StrategyGridProps) {
    const [dialogKey, setDialogKey] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<StrategyData | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [overrides, setOverrides] = useState<Overrides>({});
    const [saving, setSaving] = useState(false);

    // Check user role
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.role === "ADMIN") setIsAdmin(true); })
            .catch(() => {});
    }, []);

    // Load overrides (admin only)
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            const userData = localStorage.getItem("user");
            if (userData) {
                const user = JSON.parse(userData);
                if (user.role !== "ADMIN") return;
            }
        } catch {}
        fetch(`${API_URL}/admin/settings`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.ok ? r.json() : [])
            .then((settings: { key: string; value: string }[]) => {
                const found = settings.find((s) => s.key === "strategy_overrides");
                if (found) {
                    try { setOverrides(JSON.parse(found.value)); } catch {}
                }
            })
            .catch(() => {});
    }, []);

    const getStrategy = useCallback((key: string): StrategyData => {
        const base = StrategyDescriptions[key];
        const ov = overrides[key];
        if (!ov) return base;
        return {
            ...base,
            ...ov,
            applies: ov.applies ?? base.applies,
            tactics: ov.tactics ?? base.tactics,
        };
    }, [overrides]);

    const openDialog = (key: string) => {
        setDialogKey(key);
        setEditing(false);
        setEditData(null);
    };

    const startEdit = () => {
        if (!dialogKey) return;
        setEditData({ ...getStrategy(dialogKey) });
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setEditData(null);
    };

    const saveEdit = async () => {
        if (!dialogKey || !editData) return;
        setSaving(true);
        const newOverrides = { ...overrides, [dialogKey]: editData };
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/admin/settings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    key: "strategy_overrides",
                    value: JSON.stringify(newOverrides),
                    description: "Strategy text overrides from admin UI",
                }),
            });
            if (res.ok) {
                setOverrides(newOverrides);
                setEditing(false);
                setEditData(null);
                setDialogKey(null);
            }
        } catch {}
        setSaving(false);
    };

    const updateEditField = (field: keyof StrategyData, value: string) => {
        if (!editData) return;
        setEditData({ ...editData, [field]: value });
    };

    const updateListItem = (field: "applies" | "tactics", idx: number, value: string) => {
        if (!editData) return;
        const list = [...editData[field]];
        list[idx] = value;
        setEditData({ ...editData, [field]: list });
    };

    const addListItem = (field: "applies" | "tactics") => {
        if (!editData) return;
        setEditData({ ...editData, [field]: [...editData[field], ""] });
    };

    const removeListItem = (field: "applies" | "tactics", idx: number) => {
        if (!editData) return;
        setEditData({ ...editData, [field]: editData[field].filter((_, i) => i !== idx) });
    };

    const currentStrat = dialogKey ? getStrategy(dialogKey) : null;

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(StrategyDescriptions).map(([key]) => {
                    const strat = getStrategy(key);
                    const isSelected = selectedStrategy === key;
                    return (
                        <div
                            key={key}
                            onClick={() => {
                                if (!readOnly && onSelect) onSelect(key);
                                openDialog(key);
                            }}
                            className={cn(
                                "relative flex flex-col p-4 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer",
                                isSelected
                                    ? "border-[#2E7D5E] bg-[#2E7D5E]/5 shadow-sm"
                                    : "border-transparent bg-white hover:border-[#2E7D5E]/20"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant={isSelected ? "default" : "outline"} className="font-mono">
                                    {strat.code}
                                </Badge>
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 -mr-2 -mt-2 text-muted-foreground"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-sm p-4 bg-popover text-popover-foreground border shadow-xl z-50">
                                            <div className="space-y-3">
                                                <div>
                                                    <h4 className="font-bold text-base flex items-center gap-2">
                                                        {strat.name}
                                                        <Badge variant="secondary" className="text-[10px]">{strat.type}</Badge>
                                                    </h4>
                                                    <p className="text-sm mt-1">{strat.description}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Применяется если:</span>
                                                    <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                                                        {strat.applies.map((item, i) => (
                                                            <li key={i}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                    <div>
                                                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Цель</span>
                                                        <p className="text-xs font-medium">{strat.goal}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Срок</span>
                                                        <p className="text-xs font-medium">{strat.duration}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>

                            <h3 className="font-semibold text-sm mb-1 line-clamp-1" title={strat.name}>
                                {strat.name}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {strat.description}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Strategy Detail Dialog */}
            <Dialog open={!!dialogKey} onOpenChange={(open) => { if (!open) { setDialogKey(null); cancelEdit(); } }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    {currentStrat && dialogKey && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    {editing ? (
                                        <Input
                                            value={editData?.name ?? ""}
                                            onChange={(e) => updateEditField("name", e.target.value)}
                                            className="text-lg font-semibold"
                                        />
                                    ) : (
                                        <>
                                            <Badge variant="outline" className="font-mono text-base">{currentStrat.code}</Badge>
                                            {currentStrat.name}
                                            <Badge variant="secondary">{currentStrat.type}</Badge>
                                        </>
                                    )}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-5 mt-2">
                                {/* Description */}
                                <div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Описание</span>
                                    {editing ? (
                                        <Textarea
                                            value={editData?.description ?? ""}
                                            onChange={(e) => updateEditField("description", e.target.value)}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <p className="text-sm mt-1">{currentStrat.description}</p>
                                    )}
                                </div>

                                {/* Applies */}
                                <div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Применяется если:</span>
                                    {editing ? (
                                        <div className="space-y-2 mt-1">
                                            {editData?.applies.map((item, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <Input
                                                        value={item}
                                                        onChange={(e) => updateListItem("applies", i, e.target.value)}
                                                        className="flex-1"
                                                    />
                                                    <Button variant="ghost" size="icon" onClick={() => removeListItem("applies", i)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => addListItem("applies")}>
                                                <Plus className="h-3 w-3 mr-1" /> Добавить
                                            </Button>
                                        </div>
                                    ) : (
                                        <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                                            {currentStrat.applies.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Tactics */}
                                <div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Тактики</span>
                                    {editing ? (
                                        <div className="space-y-2 mt-1">
                                            {editData?.tactics.map((item, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <Input
                                                        value={item}
                                                        onChange={(e) => updateListItem("tactics", i, e.target.value)}
                                                        className="flex-1"
                                                    />
                                                    <Button variant="ghost" size="icon" onClick={() => removeListItem("tactics", i)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => addListItem("tactics")}>
                                                <Plus className="h-3 w-3 mr-1" /> Добавить
                                            </Button>
                                        </div>
                                    ) : (
                                        <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                                            {currentStrat.tactics.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Goal & Duration */}
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Цель</span>
                                        {editing ? (
                                            <Input
                                                value={editData?.goal ?? ""}
                                                onChange={(e) => updateEditField("goal", e.target.value)}
                                                className="mt-1"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium mt-1">{currentStrat.goal}</p>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Срок</span>
                                        {editing ? (
                                            <Input
                                                value={editData?.duration ?? ""}
                                                onChange={(e) => updateEditField("duration", e.target.value)}
                                                className="mt-1"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium mt-1">{currentStrat.duration}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Admin footer */}
                            {isAdmin && (
                                <DialogFooter className="mt-4">
                                    {editing ? (
                                        <>
                                            <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                                                <X className="h-4 w-4 mr-1" /> Отмена
                                            </Button>
                                            <Button onClick={saveEdit} disabled={saving}>
                                                <Save className="h-4 w-4 mr-1" /> {saving ? "Сохранение..." : "Сохранить"}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="outline" onClick={startEdit}>
                                            <Pencil className="h-4 w-4 mr-1" /> Редактировать
                                        </Button>
                                    )}
                                </DialogFooter>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
