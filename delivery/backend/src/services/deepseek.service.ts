import axios from 'axios';

interface PropertyContext {
    address: string;
    residentialComplex: string;
    price: number;
    area: number;
    floor: number;
    totalFloors: number;
    yearBuilt: number;
    repairState: string;
    calculatedClass: string;
    liquidityScore: number;
    activeStrategy: string;
}

export interface AiStrategyResult {
    finalStrategy: string;
    reasoning: string;
    liquidityScore: number;
}

export class DeepSeekService {
    private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions';

    private async getApiKey(): Promise<string> {
        try {
            // Try fetching from DB first
            // We need to import prisma dynamically or ensure it's available. 
            // Since this is a service, importing from lib/prisma is fine.
            const prisma = require('../lib/prisma').default;
            const setting = await prisma.systemSettings.findUnique({
                where: { key: 'DEEPSEEK_API_KEY' }
            });
            if (setting?.value) return setting.value;
        } catch (e) {
            // console.warn("Could not fetch key from DB (migration might be pending):", e);
        }
        return process.env.DEEPSEEK_API_KEY || '';
    }

    async generateStrategyJustification(context: PropertyContext): Promise<{ reasoning: string; script: string }> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            return { reasoning: "API ключ не настроен (DB/Env)", script: "" };
        }

        const prompt = `
Ты - аналитик элитного CRM агентства недвижимости "CASA".
Объект: ${context.residentialComplex}, ${context.area}м², ${context.price} KZT.
Рассчитанная стратегия: ${context.activeStrategy}.
Класс: ${context.calculatedClass}. Ликвидность: ${context.liquidityScore}/100.

ЗАДАЧА:
1. Напиши 'Обоснование': почему математика выбрала эту стратегию (строго 1-2 предложения).
2. Напиши 'Рекомендацию брокеру': скрипт что сказать клиенту (1-2 уверенные фразы).

ВЕРНИ ОТВЕТ ТОЛЬКО В ФОРМАТЕ JSON:
{
  "reasoning": "текст обоснования",
  "script": "текст скрипта"
}
`;

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a professional real estate analyst. Output valid JSON only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 500,
                    response_format: { type: 'json_object' }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const content = response.data.choices[0].message.content;
            try {
                return JSON.parse(content);
            } catch (e) {
                console.error("JSON Parse Error:", content);
                return { reasoning: content, script: "" };
            }
        } catch (error) {
            console.error('DeepSeek API Error:', error);
            return { reasoning: "Ошибка генерации AI", script: "" };
        }
    }

    async determineStrategy(context: PropertyContext): Promise<AiStrategyResult> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            return {
                finalStrategy: context.activeStrategy,
                reasoning: "AI недоступен, использована математическая модель.",
                liquidityScore: context.liquidityScore
            };
        }

        const prompt = `
ТЫ - ЭКСПЕРТ ПО НЕДВИЖИМОСТИ С 20-ЛЕТНИМ СТАЖЕМ.
Твоя задача: Перепроверить математическую модель оценки стратегии продажи.

ДАННЫЕ ОБЪЕКТА:
- ЖК: ${context.residentialComplex}
- Адрес: ${context.address}
- Год: ${context.yearBuilt}. Класс: ${context.calculatedClass}
- Цена: ${context.price}
- Ремонт: ${context.repairState}
- Текущая стратегия (Math): ${context.activeStrategy} (Score: ${context.liquidityScore})

ПРАВИЛА (SOFT LOGIC):
1. Если Цена ВЫГОДНАЯ (ниже рынка) -> Это НЕ "LOW_LIQUIDITY", это "MARKET_SALE" или "URGENT_SALE".
2. "LOW_LIQUIDITY" (Ограниченный спрос) ставь ТОЛЬКО если объект старый (>1990), без ремонта И цена завышена/в рынке.
3. Если есть обременения/залог -> "LEGAL_COMPLEX".
4. Если клиент хочет "Попробовать продать подороже" -> "PRICE_DISCOVERY" (Тест цены).

ВЕРНИ JSON:
{
  "finalStrategy": "ENUM_VALUE", // (MARKET_SALE, URGENT_SALE, LOW_LIQUIDITY, LEGAL_COMPLEX, PRICE_DISCOVERY, etc.)
  "reasoning": "Краткое и жесткое обоснование (1 предложение).",
  "liquidityScore": 0-100 // Скорректируй балл ликвидности, если считаешь нужным.
}
`;

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a senior real estate strategist. Output valid JSON only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    response_format: { type: 'json_object' }
                },
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );

            const result = JSON.parse(response.data.choices[0].message.content);
            return {
                finalStrategy: result.finalStrategy || context.activeStrategy,
                reasoning: result.reasoning || "AI подтвердил стратегию.",
                liquidityScore: typeof result.liquidityScore === 'number' ? result.liquidityScore : context.liquidityScore
            };

        } catch (error) {
            console.error('DeepSeek Strategy Error:', error);
            return {
                finalStrategy: context.activeStrategy,
                reasoning: "Ошибка AI анализа. Применена базовая стратегия.",
                liquidityScore: context.liquidityScore
            };
        }
    }

    async generateMarketingDescription(context: any): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            return "API ключ не настроен";
        }

        const prompt = `
Ты - профессиональный копирайтер по недвижимости.
Напиши продающий текст объявления для Instagram и Krisha.kz.

Объект:
- ЖК: ${context.residentialComplex}
- Район: ${context.district}
- Площадь: ${context.area} м²
- Этаж: ${context.floor}/${context.totalFloors}
- Ремонт: ${context.repairState}

Стратегия продажи: ${context.strategy}
(Тон: ${context.strategy === 'URGENT_SALE' ? 'Срочный, динамичный' : context.strategy === 'PRICE_DISCOVERY' ? 'Интригующий, премиальный' : 'Деловой, уверенный'})

ЗАДАЧА:
1. Яркий заголовок (с эмодзи).
2. Основной текст (3-4 абзаца), раскрывающий плюсы.
3. УТП (Уникальные торговые преимущества) - 3 пункта буллитами.
4. Призыв к действию.

Пиши на русском языке. Используй эмодзи умеренно.
`;

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a real estate copywriter.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.8,
                    max_tokens: 800,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('DeepSeek Marketing Gen Error:', error);
            return "Не удалось сгенерировать описание.";
        }
    }

    async analyzeShowFeedbacks(feedbacks: string[]): Promise<{ suggestStrategyChange: boolean; criticalIssue: boolean; recommendation: string }> {
        const apiKey = await this.getApiKey();
        if (!apiKey) return { suggestStrategyChange: false, criticalIssue: false, recommendation: "" };

        const prompt = `
ТЫ - АНАЛИТИК НЕДВИЖИМОСТИ.
Проанализируй отзывы покупателей после показов:
${feedbacks.map(f => `- ${f}`).join('\n')}

ЗАДАЧА:
1. Выяви общую проблему (если есть).
2. Если 3+ отзыва говорят "Дорого" или "Цена завышена", предложи сменить стратегию на "Выравнивание ожиданий" (EXPECTATION_ALIGNMENT).
3. Верни JSON:
{
  "suggestStrategyChange": boolean, // true если надо менять стратегию
  "criticalIssue": boolean, // true если есть явный недостаток (ремонт, запах, и т.д.)
  "recommendation": "Краткий совет брокеру (макс 15 слов)"
}
`;
        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You are a real estate analyst. Output valid JSON only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5,
                    response_format: { type: 'json_object' }
                },
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
            return JSON.parse(response.data.choices[0].message.content);
        } catch (e) {
            console.error("AI Analysis Error", e);
            return { suggestStrategyChange: false, criticalIssue: false, recommendation: "" };
        }
    }
}

export const deepSeekService = new DeepSeekService();
