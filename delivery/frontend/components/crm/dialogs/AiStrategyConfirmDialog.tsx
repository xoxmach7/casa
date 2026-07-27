import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Edit2, BrainCircuit, Sparkles, AlertTriangle } from "lucide-react";
import { StrategyDescriptions } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { StrategySelectDialog } from "./StrategySelectDialog";

interface AiStrategyConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    strategyCode: string | null;
    explanation: string | null;
    onConfirm: () => void;
    onChange: () => void; // Trigger manual selection
}

export function AiStrategyConfirmDialog({
    open,
    onOpenChange,
    strategyCode,
    explanation,
    onConfirm,
    onChange
}: AiStrategyConfirmDialogProps) {

    // Fallback if AI fails or returns weird code
    const strat = strategyCode ? StrategyDescriptions[strategyCode] : null;

    if (!strat) {
        // Validation/Error state handled gracefully?
        // Or just redirect to manual?
        // For now render a fallback "AI Unsure" view
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Затрудняется с выбором</DialogTitle>
                        <DialogDescription>
                            Системе не удалось однозначно определить стратегию. Пожалуйста, выберите вручную.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={onChange}>Выбрать вручную</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    // Parse explanation JSON if possible
    let parsedExplanation = explanation;
    try {
        if (explanation) {
            const parsed = JSON.parse(explanation);
            parsedExplanation = parsed.reasoning || parsed.text || explanation;
        }
    } catch (e) { }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">CASA AI Analysis</span>
                    </div>
                    <DialogTitle className="text-2xl">Рекомендуемая Стратегия</DialogTitle>
                    <DialogDescription>
                        На основе анализа данных объекта и рынка, система предлагает:
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Strategy Card */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white border-l-4 border-indigo-500 rounded-lg p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <Badge className="text-sm font-mono px-2 bg-indigo-600 hover:bg-indigo-700">
                                {strat.code}
                            </Badge>
                            <span className="text-xs font-semibold text-muted-foreground uppercase">{strat.type}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{strat.name}</h3>
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">
                            {strat.description}
                        </p>

                        <div className="bg-white/60 rounded p-3 text-xs text-indigo-900 font-medium border border-indigo-100/50">
                            <span className="block mb-1 opacity-70 uppercase text-[10px]">Обоснование AI:</span>
                            {parsedExplanation}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-100">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p>
                            Цель: <b>{strat.goal}</b>. Срок реализации: <b>{strat.duration}</b>.
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={onConfirm} className="sm:flex-1 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Принять Стратегию
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
