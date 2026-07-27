import { useMemo } from 'react';
import { Seller, CrmProperty } from '@/types/kanban';

export interface ReadinessResult {
    score: number;
    missingSteps: string[];
    alerts: string[];
    isReadyForInterview: boolean;
}

export function useLeadReadiness(seller: Seller | null, property: CrmProperty | null): ReadinessResult {
    return useMemo(() => {
        if (!seller) {
            return {
                score: 0,
                missingSteps: [],
                alerts: ["Нет данных продавца"],
                isReadyForInterview: false
            };
        }

        let score = 0;
        const missingSteps: string[] = [];
        const alerts: string[] = [];

        // 1. Contact Info (+20%)
        const hasContact = seller.firstName && seller.lastName && seller.phone;
        if (hasContact) {
            score += 20;
        } else {
            missingSteps.push("Заполнить контактные данные");
            alerts.push("⚠ Контакт не заполнен");
        }

        // 2. Property (+20%)
        if (property) {
            score += 20;
        } else {
            missingSteps.push("Добавить объект");
            alerts.push("⚠ Нет объекта недвижимости");
        }

        // 3. Strategy (+30%)
        const hasStrategy = seller.strategyConfirmed || (property?.activeStrategy !== undefined);
        if (hasStrategy) {
            score += 30;
        } else {
            missingSteps.push("Определить стратегию");
            alerts.push("⚠ Стратегия не выбрана");
        }

        // 4. Photos (+10%)
        const hasPhotos = property?.images && property.images.length >= 1; // Changed to >= 1 per spec (>0)
        if (hasPhotos) {
            score += 10;
        } else {
            if (property) {
                missingSteps.push("Загрузить фото");
            }
        }

        // 5. Documents / Verification (+20%)
        const docsVerified = property?.documentsVerified; // Assuming this field exists or similar
        if (docsVerified) {
            score += 20;
        } else {
            if (property) missingSteps.push("Проверить документы");
        }

        return {
            score,
            missingSteps,
            alerts,
            isReadyForInterview: score >= 50
        };
    }, [seller, property]);
}
