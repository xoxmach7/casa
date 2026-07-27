import React, { useEffect, useState } from 'react';
import { Brain, Search, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StrategyLoader() {
    const [step, setStep] = useState(0);

    const steps = [
        { text: "Анализ рыночных данных...", icon: Search, color: "text-[#2E7D5E]" },
        { text: "Сравнение с конкурентами...", icon: TrendingUp, color: "text-[#D4A843]" },
        { text: "Формирование стратегии...", icon: Brain, color: "text-[#3A9D73]" },
        { text: "Готово!", icon: CheckCircle2, color: "text-[#1B5E40]" }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 800);

        return () => clearInterval(interval);
    }, []);

    const activeStep = steps[step];
    const Icon = activeStep.icon;

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-all duration-300">
            <div className="relative flex flex-col items-center p-8 text-center animate-in fade-in zoom-in duration-500">

                {/* Animated Icon Circle */}
                <div className={cn(
                    "relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl ring-4 transition-all duration-500",
                    step === 3 ? "ring-[#2E7D5E]/20 scale-110" : "ring-[#2E7D5E]/10 animate-pulse"
                )}>
                    {/* Ping effect behind */}
                    {step < 3 && (
                        <div className="absolute inset-0 rounded-full bg-[#2E7D5E]/20 opacity-20 animate-ping" />
                    )}

                    <Icon className={cn("h-10 w-10 transition-all duration-500", activeStep.color)} />

                    {/* Progress ring/spinner */}
                    {step < 3 && (
                        <div className="absolute inset-0 rounded-full border-4 border-t-[#2E7D5E] border-r-transparent border-b-[#2E7D5E] border-l-transparent opacity-20 animate-spin" />
                    )}
                </div>

                {/* Text Status */}
                <h3 className="text-xl font-semibold text-gray-900 mb-2 min-w-[200px] transition-all duration-300">
                    {activeStep.text}
                </h3>

                <p className="text-sm text-gray-500">
                    DeepSeek AI анализирует параметры вашего объекта
                </p>

                {/* Step dots */}
                <div className="flex gap-2 mt-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-500",
                                i === step ? "w-6 bg-[#2E7D5E]" :
                                    i < step ? "w-1.5 bg-[#2E7D5E]/40" : "w-1.5 bg-gray-200"
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
