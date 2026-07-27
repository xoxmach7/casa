"use client";

import { Brain, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MESSAGES = [
    "Анализ технических параметров...",
    "Оценка ликвидности района...",
    "Проверка конкурентов...",
    "Генерация рекомендаций...",
    "Формирование стратегии..."
];

interface StrategyLoaderProps {
    className?: string;
}

export function StrategyLoader({ className }: StrategyLoaderProps) {
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={cn("absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-300", className)}>
            <div className="relative mb-4">
                <div className="absolute inset-0 bg-[#2E7D5E]/20 blur-xl rounded-full animate-pulse" />
                <Brain className="w-10 h-10 text-[#2E7D5E] animate-bounce relative z-10" />
                <Sparkles className="w-4 h-4 text-[#FFD700] absolute -top-1 -right-1 animate-spin-slow" />
            </div>

            <h4 className="font-semibold text-[#1B5E40] mb-1">DeepSeek AI</h4>
            <p className="text-sm text-[#2E7D5E]/80 min-h-[1.5em] transition-all duration-300">
                {MESSAGES[msgIndex]}
            </p>

            <div className="mt-4 flex gap-1">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#2E7D5E] animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}
