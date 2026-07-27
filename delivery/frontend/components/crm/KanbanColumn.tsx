import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface KanbanColumnProps {
    id: string;
    title: string;
    count?: number;
    description?: string;
    children: React.ReactNode;
    variant?: "blue" | "pink" | "green" | "cyan" | "default";
    color?: string;
}

const VARIANT_HEADER: Record<string, string> = {
    blue: "bg-[#2E7D5E] text-white",
    pink: "bg-[#D4A843] text-white",
    green: "bg-[#1B5E40] text-white",
    cyan: "bg-[#3A9D73] text-white",
    default: "bg-[#4A5568] text-white",
};

const VARIANT_BG: Record<string, string> = {
    blue: "bg-[#F0FAF5]",
    pink: "bg-[#FFFBF0]",
    green: "bg-[#ECFDF5]",
    cyan: "bg-[#F0FDF9]",
    default: "bg-[#F7FAFC]",
};

export function KanbanColumn({ id, title, count = 0, description, children, variant = "default", color }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id });

    const headerStyle = color
        ? { backgroundColor: color, color: "white" }
        : undefined;

    const bgClass = color ? "bg-gray-50" : (VARIANT_BG[variant] || VARIANT_BG.default);

    return (
        <div className={cn(
            "flex flex-col rounded-xl shrink-0 w-[272px] shadow-sm border border-border/40",
            bgClass,
            isOver && "ring-2 ring-[#FFD700]/60 shadow-md"
        )}>
            {/* Header — fixed */}
            <div
                className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-t-xl text-sm font-semibold shrink-0",
                    !color && (VARIANT_HEADER[variant] || VARIANT_HEADER.default)
                )}
                style={headerStyle}
            >
                <div className="flex items-center gap-1.5">
                    <span className="uppercase tracking-wide text-xs">{title}</span>
                    {description && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-3 h-3 opacity-70 hover:opacity-100" />
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                                    {description}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <span className="bg-white/25 text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center backdrop-blur-sm">
                    {count}
                </span>
            </div>

            {/* Cards — scrollable, hidden scrollbar */}
            <div
                ref={setNodeRef}
                className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px] scrollbar-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {isOver && (
                    <div className="h-12 rounded-lg border-2 border-dashed border-[#2E7D5E]/40 bg-[#2E7D5E]/5 flex items-center justify-center animate-in fade-in">
                        <span className="text-xs text-[#2E7D5E] font-medium">Отпустите здесь</span>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
