"use client";

// Импорт ради сайд-эффекта: ставит credentials:'include' на все запросы к API,
// чтобы httpOnly-cookie с сессией уходила на бэкенд. Провайдер монтируется в
// корневом layout, поэтому патч встаёт до первых запросов из компонентов.
import "@/lib/api-credentials";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
