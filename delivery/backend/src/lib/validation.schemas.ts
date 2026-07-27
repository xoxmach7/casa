// =========================================
// ZOD VALIDATION SCHEMAS
// CASA CRM - SELLER & PROPERTY VALIDATION
// =========================================

import { z } from 'zod';
import { normalizePhone } from './phone.utils';

// =========================================
// ENUMS (зеркалируем Prisma enums)
// =========================================

export const PropertyClassEnum = z.enum([
    'OLD_FUND', 'ECONOMY', 'COMFORT', 'COMFORT_PLUS', 'BUSINESS'
]);

export const StrategyTypeEnum = z.enum([
    'MARKET_SALE', 'URGENT_SALE', 'SALE_TO_PURCHASE',
    'EXPECTATION_ALIGNMENT', 'LIMITED_ENGAGEMENT', 'INVESTMENT_EXIT',
    'LEGAL_COMPLEX', 'LOW_LIQUIDITY', 'ALTERNATIVE_EXIT',
    'REJECT_OBJECT', 'HIGH_TICKET_SALE', 'PRICE_DISCOVERY'
]);

export const LiquidityLevelEnum = z.enum([
    'HIGH', 'ABOVE_AVERAGE', 'AVERAGE', 'BELOW_AVERAGE', 'LOW'
]);

export const FinanceTypeEnum = z.enum([
    'MORTGAGE_AVAILABLE', 'MORTGAGE_LIMITED', 'CASH_ONLY'
]);

export const SellerFunnelStageEnum = z.enum([
    'CONTACT', 'INTERVIEW', 'STRATEGY', 'CONTRACT_SIGNING', 'CANCELLED'
]);

export const PropertyFunnelStageEnum = z.enum([
    'CREATED', 'PREPARATION', 'LEADS', 'SHOWS', 'DEAL', 'SOLD', 'POST_SERVICE', 'CANCELLED'
]);

export const SaleReasonEnum = z.enum([
    'RELOCATION',         // Переезд
    'SIZE_CHANGE',        // Улучшение жилищных условий
    'INHERITANCE',        // Наследство
    'DIVORCE',            // Развод
    'FINANCIAL_NEED',     // Финансовая необходимость
    'INVESTMENT',         // Инвестиционная продажа
    'OTHER'               // Другое
]);

export const SaleDeadlineEnum = z.enum([
    'URGENT_30_DAYS',     // Срочно — до 1 месяца
    'NORMAL_90_DAYS',     // Средняя — 1–2 месяца
    'FLEXIBLE_180_DAYS',  // Не срочно — более 2 месяцев
    'NO_RUSH'             // Без срочности
]);

export const MarketAssessmentEnum = z.enum([
    'ADEQUATE',     // Адекватное
    'OVERPRICED',   // Завышенное
    'UNCERTAIN'     // Неопределённое
]);

export const IncomeSourceEnum = z.enum([
    'EMPLOYMENT',       // Работа по найму
    'BUSINESS',         // Бизнес / ИП
    'RENTAL_INCOME',    // Доход от аренды
    'PENSION',          // Пенсия
    'OTHER'             // Другое
]);

export const ReadyToFollowEnum = z.enum([
    'YES', 'PARTIAL', 'NO'
]);

export const NextPurchaseFormatEnum = z.enum([
    'NEW_BUILDING',   // Новостройка
    'SECONDARY',      // Вторичка
    'HOUSE',          // Дом
    'NOT_DECIDED'     // Не определился
]);

export const BuildingTypeEnum = z.enum([
    'MONOLITH', 'BRICK', 'PANEL', 'MONOLITH_BRICK', 'BLOCK'
]);

export const LayoutTypeEnum = z.enum([
    'EURO_FREE',            // Евро / свободная
    'ISOLATED',             // Изолированные комнаты
    'ADJACENT',             // Смежные комнаты
    'WALK_THROUGH',         // Проходные комнаты
    'STUDIO'                // Студия
]);

export const BathroomTypeEnum = z.enum([
    'COMBINED',             // Совмещённый
    'SEPARATE',             // Раздельный
    'MULTIPLE'              // 2 и более
]);

export const BalconyTypeEnum = z.enum([
    'NONE', 'BALCONY', 'LOGGIA'
]);

export const LocationQualityEnum = z.enum([
    'TOP',            // Топ-локация
    'GOOD',           // Хорошая
    'ABOVE_AVERAGE',  // Выше средней
    'NORMAL',         // Нормальная
    'WEAK',           // Слабая
    'REMOTE'          // Удалённая
]);

export const ViewTypeEnum = z.enum([
    'PANORAMIC',          // Панорамный
    'PARK_WATER',         // Парк / вода
    'STREET',             // Улица
    'COURTYARD',          // Двор
    'WELL_COURTYARD',     // Двор-колодец
    'ADJACENT_BUILDINGS', // Соседние дома
    'INDUSTRIAL'          // Промзона / ТЭЦ / стройка
]);

export const ParkingTypeEnum = z.enum([
    'UNDERGROUND',    // Подземный
    'ABOVE_GROUND',   // Закрытый наземный
    'OPEN',           // Открытый
    'NONE'            // Отсутствует
]);

export const RepairTypeEnum = z.enum([
    'NONE',           // Без ремонта
    'COSMETIC',       // Косметический
    'CAPITAL',        // Капитальный
    'EURO',           // Евро
    'DESIGNER'        // Дизайнерский
]);

export const ActualConditionEnum = z.enum([
    'EXCELLENT',        // Отличное
    'GOOD',             // Хорошее
    'NEEDS_INVESTMENT', // Требует вложений
    'CRITICAL'          // Критическое
]);

export const LobbyTypeEnum = z.enum([
    'PREMIUM',          // Премиум (консьерж / ресепшн)
    'MODERN',           // Современный
    'STANDARD',         // Стандартный
    'SIMPLE',           // Простой
    'NEEDS_REPAIR'      // Требует ремонта
]);

export const AccessSystemEnum = z.enum([
    'FACE_ID',          // Face ID / Smart-access
    'SMART_ACCESS',     // Smart-access
    'ELECTRONIC_CARD',  // Электронная карта
    'INTERCOM',         // Домофон
    'CODE_LOCK',        // Кодовый замок
    'KEY'               // Ключ
]);

export const MopStateEnum = z.enum([
    'EXCELLENT',        // Отличное
    'GOOD',             // Хорошее
    'SATISFACTORY',     // Удовлетворительное
    'NEEDS_REPAIR',     // Требует ремонта
    'CRITICAL'          // Критическое
]);

export const EncumbranceTypeEnum = z.enum([
    'NONE',             // Нет
    'SHARES',           // Доли
    'ENCUMBRANCE',      // Обременения
    'INHERITANCE',      // Наследство
    'POWER_OF_ATTORNEY' // Доверенность
]);

export const GlazingTypeEnum = z.enum([
    'PANORAMIC',    // Панорамное
    'ENLARGED',     // Увеличенное
    'PANORAMIC',    // Панорамное
    'ENLARGED',     // Увеличенное
    'STANDARD'      // Стандартное
]);

export const ShowStatusEnum = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const FeedbackSentimentEnum = z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export const OfferStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'REJECTED']);
export const BuyerStatusEnum = z.enum(['NEW', 'ACTIVE', 'OFFER_MADE', 'ARCHIVED', 'REFUSAL']);

// =========================================
// SELLER SCHEMAS
// =========================================

// Этап 1: КОНТАКТ (расширенная форма — Casa Pro Expansion)
export const SellerContactStageSchema = z.object({
    // === 1. Основная информация ===
    firstName: z.string().min(2, 'Имя: минимум 2 символа'),
    lastName: z.string().min(2, 'Фамилия: минимум 2 символа'),
    phone: z.string().min(10, 'Некорректный формат телефона').transform(val => normalizePhone(val)),
    email: z.string().email('Некорректный email').optional().or(z.literal('')),
    city: z.string().optional(),
    source: z.string().optional(),
    managerComment: z.string().optional(),

    // === 2. Причина и сроки (опционально на этапе контакта) ===
    reason: SaleReasonEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    reasonOther: z.string().optional(),
    deadline: SaleDeadlineEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),

    // === 3. Ценовые ожидания (опционально) ===
    expectedPrice: z.union([z.literal(''), z.coerce.number().positive("Цена должна быть больше 0")]).optional().transform(val => val === '' ? undefined : val),
    minPrice: z.union([z.literal(''), z.coerce.number().positive("Цена должна быть больше 0")]).optional().transform(val => val === '' ? undefined : val),
    readyToNegotiate: z.coerce.boolean().default(true),
    marketAssessment: MarketAssessmentEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),

    // === 4. Планы и финансы (опционально) ===
    plansToPurchase: z.coerce.boolean().default(false),
    nextPurchaseFormat: z.string().optional(),
    purchaseBudget: z.union([z.literal(''), z.coerce.number().positive("Бюджет должен быть больше 0")]).optional().transform(val => val === '' ? undefined : val),
    incomeSource: z.string().optional(),
    hasDebts: z.coerce.boolean().default(false),
    loanPaymentAmount: z.union([z.literal(''), z.coerce.number().nonnegative("Сумма не может быть отрицательной")]).optional().transform(val => val === '' ? undefined : val),

    // === 5. Коммуникация ===
    communicationChannel: z.string().optional(),
    preferredTime: z.string().optional(),

    // === Legacy/System ===
    trustLevel: z.union([z.literal(''), z.coerce.number().min(1).max(5)]).default(3).transform(val => val === '' ? 3 : val),
    readyToFollowRecommendations: ReadyToFollowEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    readyForExclusive: z.coerce.boolean().default(false),
    funnelStage: z.literal('CONTACT').default('CONTACT'),
    customStageId: z.string().cuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
    projectId: z.string().cuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
    apartmentId: z.string().cuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
    funnelId: z.string().nullable().optional(),
});

// Этап 2: ИНТЕРВЬЮ (полные данные — ВСЁ обязательно!)
export const SellerInterviewStageSchema = z.object({
    // === Основные данные ===
    firstName: z.string().min(2, 'Минимум 2 символа'),
    lastName: z.string().min(2, 'Минимум 2 символа'),
    middleName: z.string().optional(),
    phone: z.string().min(10, 'Некорректный формат телефона').transform(val => normalizePhone(val)),
    email: z.string().email().optional().or(z.literal('')),
    iin: z.string().length(12, 'ИИН должен содержать 12 цифр').optional(),

    // === 1️⃣ Причина продажи и сроки (ОБЯЗАТЕЛЬНО) ===
    reason: SaleReasonEnum,
    reasonOther: z.string().optional(), // если reason = OTHER
    deadline: SaleDeadlineEnum,

    // === 2️⃣ Ценовые ожидания (ОБЯЗАТЕЛЬНО) ===
    expectedPrice: z.coerce.number().positive('Укажите ожидаемую цену'),
    minPrice: z.coerce.number().positive('Укажите минимальную цену').optional(),
    marketAssessment: MarketAssessmentEnum,
    readyToNegotiate: z.coerce.boolean().default(true),

    // === 3️⃣ Планы после продажи ===
    plansToPurchase: z.coerce.boolean().default(false),
    plansMortgage: z.coerce.boolean().default(false),
    nextPurchaseFormat: NextPurchaseFormatEnum.optional(),
    purchaseBudget: z.coerce.number().positive().optional(),

    // === 4️⃣ Финансовые возможности ===
    incomeSource: IncomeSourceEnum.optional(),
    incomeAmount: z.coerce.number().nonnegative().optional(),
    hasDebts: z.coerce.boolean().default(false),

    // === 5️⃣ Готовность работать с Casa (ОБЯЗАТЕЛЬНО) ===
    readyToFollowRecommendations: ReadyToFollowEnum,
    readyForExclusive: z.coerce.boolean(),
    trustLevel: z.coerce.number().min(1).max(5),

    // === 6️⃣ Комментарии ===
    managerComment: z.string().optional(),

    // Missing Fields (Fix for Persistence)
    source: z.string().optional(),
    communicationChannel: z.string().optional(),
    preferredTime: z.string().optional(),
    loanPaymentAmount: z.coerce.number().nonnegative().optional(),

    funnelStage: z.literal('INTERVIEW'),
});

// Этап 3: СТРАТЕГИЯ (данные уже собраны, только подтверждение)
export const SellerStrategyStageSchema = SellerInterviewStageSchema.extend({
    funnelStage: z.literal('STRATEGY'),
    strategyConfirmed: z.coerce.boolean().default(false),
    strategyNotes: z.string().optional(),
});

// Переход на этап ИНТЕРВЬЮ (мягкая валидация для Drag-and-Drop)
export const SellerInterviewTransitionSchema = z.object({
    reason: SaleReasonEnum,
    deadline: SaleDeadlineEnum,
});

// Обновление продавца (универсальная схема)
export const SellerUpdateSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    middleName: z.string().optional(),
    phone: z.string().regex(/^(\+?7|8)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/).optional().transform(val => val ? normalizePhone(val) : val),
    email: z.string().email().optional().or(z.literal('')),
    iin: z.string().length(12).optional(),
    reason: SaleReasonEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    reasonOther: z.string().optional(),
    deadline: SaleDeadlineEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    expectedPrice: z.union([z.literal(''), z.coerce.number().positive()]).optional().transform(val => val === '' ? undefined : val),
    minPrice: z.union([z.literal(''), z.coerce.number().positive()]).optional().transform(val => val === '' ? undefined : val),
    marketAssessment: MarketAssessmentEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    readyToNegotiate: z.coerce.boolean().optional(),
    plansToPurchase: z.coerce.boolean().optional(),
    plansMortgage: z.coerce.boolean().optional(),
    nextPurchaseFormat: NextPurchaseFormatEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    purchaseBudget: z.union([z.literal(''), z.coerce.number().positive()]).optional().transform(val => val === '' ? undefined : val),
    incomeSource: IncomeSourceEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    incomeAmount: z.union([z.literal(''), z.coerce.number().nonnegative()]).optional().transform(val => val === '' ? undefined : val),
    hasDebts: z.coerce.boolean().optional(),
    readyToFollowRecommendations: ReadyToFollowEnum.optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    readyForExclusive: z.coerce.boolean().optional(),
    trustLevel: z.union([z.literal(''), z.coerce.number().min(1).max(5)]).optional().transform(val => val === '' ? undefined : val),
    managerComment: z.string().optional(),

    // Missing Fields Fix
    source: z.string().optional(),
    communicationChannel: z.string().optional(),
    preferredTime: z.string().optional(),
    loanPaymentAmount: z.coerce.number().nonnegative().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),

    funnelStage: SellerFunnelStageEnum.optional(),
    customStageId: z.string().cuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
    projectId: z.string().cuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
    apartmentId: z.string().cuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
    isActive: z.coerce.boolean().optional(),
    customFields: z.record(z.any()).optional(), // New
});

// =========================================
// CRM PROPERTY SCHEMAS
// =========================================

// Этап: CREATED / PREPARATION (минимальные данные для создания)
export const CrmPropertyMinimalSchema = z.object({
    sellerId: z.string().cuid('Некорректный ID продавца'),

    // 1️⃣ Идентификация объекта
    propertyType: z.enum(['APARTMENT', 'STUDIO']).default('APARTMENT'),
    rooms: z.coerce.number().int().min(1, 'Минимум 1 комната').max(10),
    residentialComplex: z.string().min(2, 'Укажите ЖК или дом'),
    district: z.string().min(2, 'Укажите район'),
    address: z.string().optional(),

    // 2️⃣ Геометрия (ОБЯЗАТЕЛЬНО для классификации)
    area: z.coerce.number().positive('Укажите площадь'),
    floor: z.coerce.number().int().min(-1, 'Некорректный этаж').max(100),
    totalFloors: z.coerce.number().int().min(1, 'Всего этажей: минимум 1').max(100),
    yearBuilt: z.coerce.number().int().min(1900, 'Год постройки: от 1900').max(new Date().getFullYear() + 5),
    apartmentsPerFloor: z.coerce.number().int().min(1).max(20).optional(),
    elevatorCount: z.coerce.number().int().min(0).optional(),

    // Цена
    price: z.coerce.number().positive('Укажите цену'),

    funnelStage: z.literal('CREATED').default('CREATED'),
});

// Этап: INTERVIEW → STRATEGY (полные данные для классификации)
export const CrmPropertyFullSchema = CrmPropertyMinimalSchema.extend({
    // 3️⃣ Конструктив и планировка (ОБЯЗАТЕЛЬНО для класса)
    buildingType: BuildingTypeEnum,
    ceilingHeight: z.coerce.number().min(2.0).max(5.0),
    kitchenArea: z.coerce.number().positive().optional(),
    layoutType: LayoutTypeEnum,
    bathroomType: BathroomTypeEnum.optional(),
    balconyType: BalconyTypeEnum.optional(),

    // 4️⃣ Локация и окружение (ОБЯЗАТЕЛЬНО)
    locationQuality: LocationQualityEnum,
    viewType: ViewTypeEnum.optional(),

    // 5️⃣ Паркинг (ОБЯЗАТЕЛЬНО для Комфорт+ и Бизнес)
    parkingType: ParkingTypeEnum,
    parkingSpaces: z.coerce.number().int().min(0).optional(),

    // 6️⃣ Состояние квартиры (ремонт)
    repairType: RepairTypeEnum,
    actualCondition: ActualConditionEnum,

    // 7️⃣ Дом и МОП
    elevatorCount: z.coerce.number().int().min(0),
    hasFreightElevator: z.coerce.boolean().default(false),
    lobbyType: LobbyTypeEnum.optional(),
    accessSystem: AccessSystemEnum.optional(),
    mopState: MopStateEnum.optional(),
    hasClosedTerritory: z.coerce.boolean().default(false),
    lastCapitalRepairYear: z.coerce.number().int().optional(),

    // 8️⃣ Финансовый и юридический статус
    isMortgaged: z.coerce.boolean().default(false),
    mortgageBank: z.string().optional(),
    mortgageRemaining: z.coerce.number().nonnegative().optional(),
    mortgageRemovalMethod: z.string().optional(),
    encumbranceType: EncumbranceTypeEnum.default('NONE'),
    encumbranceDescription: z.string().optional(),
    documentsVerified: z.coerce.boolean().default(false),

    // 9️⃣ УТП и комплектация
    hasFloorHeating: z.coerce.boolean().default(false),
    hasWalkInCloset: z.coerce.boolean().default(false),
    hasAirConditioning: z.coerce.boolean().default(false),
    hasBuiltInAppliances: z.coerce.boolean().default(false),
    hasPanoramicWindows: z.coerce.boolean().default(false), // New
    furnitureLevel: z.enum(['NONE', 'PARTIAL', 'FULL']).optional(),
    appliancesLevel: z.enum(['NONE', 'PARTIAL', 'FULL']).optional(),

    // Бизнес-класс специфичные поля
    glazingType: GlazingTypeEnum.optional(),
    facadeMaterial: z.string().optional(),

    // Медиа
    images: z.array(z.string().url()).default([]),
    documents: z.array(z.string().url()).default([]), // New
    videoUrl: z.string().url().optional().or(z.literal('')),
    layoutImage: z.string().optional(),

    // Публикации (New)
    casaUrl: z.string().url().optional().or(z.literal('')),
    krishaUrl: z.string().url().optional().or(z.literal('')),
    knUrl: z.string().url().optional().or(z.literal('')),
    olxUrl: z.string().url().optional().or(z.literal('')),
    instagramUrl: z.string().url().optional().or(z.literal('')),
    tikTokUrl: z.string().url().optional().or(z.literal('')),

    // Мета
    notes: z.string().optional(),
    funnelStage: PropertyFunnelStageEnum.default('CREATED'),
});

// Обновление объекта
export const CrmPropertyUpdateSchema = CrmPropertyFullSchema.partial().omit({
    sellerId: true
}).extend({
    customFields: z.record(z.any()).optional(), // New
});

// =========================================
// BUYER SCHEMAS
// =========================================

export const CreateBuyerSchema = z.object({
    firstName: z.string().min(2, 'Минимум 2 символа'),
    lastName: z.string().optional(),
    phone: z.string().min(10, 'Некорректный формат телефона'),
    minBudget: z.coerce.number().positive().optional(),
    maxBudget: z.coerce.number().positive().optional(),
    preferences: z.any().optional(), // JSON
    notes: z.string().optional(),
    status: BuyerStatusEnum.default('NEW'),
});

export const UpdateBuyerSchema = CreateBuyerSchema.partial();

// =========================================
// SHOW & OFFER SCHEMAS
// =========================================

export const CreateShowSchema = z.object({
    date: z.string().datetime(), // ISO string
    buyerId: z.string().cuid(),
    propertyId: z.string().cuid(),
    status: ShowStatusEnum.default('SCHEDULED'),
    notes: z.string().optional()
});

export const UpdateShowSchema = z.object({
    date: z.string().datetime().optional(),
    status: ShowStatusEnum.optional(),
    feedback: z.string().optional(),
    feedbackSentiment: FeedbackSentimentEnum.optional(),
    rating: z.coerce.number().min(1).max(5).optional()
});

export const FeedBackSchema = z.object({
    feedback: z.string().min(3),
    rating: z.coerce.number().optional()
});

export const CreateOfferSchema = z.object({
    price: z.coerce.number().positive(),
    buyerId: z.string().cuid(),
    propertyId: z.string().cuid(),
    comment: z.string().optional()
});

export const UpdateOfferSchema = z.object({
    price: z.coerce.number().positive().optional(),
    status: OfferStatusEnum.optional(),
    comment: z.string().optional()
});

// =========================================
// HELPER: Выбор схемы по этапу воронки
// =========================================

export function getSellerSchemaByStage(stage: string) {
    switch (stage) {
        case 'CONTACT':
            return SellerContactStageSchema;
        case 'INTERVIEW':
            return SellerInterviewStageSchema;
        case 'STRATEGY':
            return SellerStrategyStageSchema;
        case 'CONTRACT_SIGNING':
            return SellerInterviewStageSchema; // те же поля + договор
        default:
            return SellerContactStageSchema;
    }
}

export function getCrmPropertySchemaByStage(stage: string) {
    switch (stage) {
        case 'CREATED':
            return CrmPropertyMinimalSchema;
        default:
            return CrmPropertyFullSchema;
    }
}

// =========================================
// VALIDATION HELPERS
// =========================================

export function validateSellerForStage(data: unknown, stage: string) {
    const schema = getSellerSchemaByStage(stage);
    return schema.safeParse(data);
}

export function validatePropertyForStage(data: unknown, stage: string) {
    const schema = getCrmPropertySchemaByStage(stage);
    return schema.safeParse(data);
}

// =========================================
// TYPE EXPORTS
// =========================================

export type SellerContactInput = z.infer<typeof SellerContactStageSchema>;
export type SellerInterviewInput = z.infer<typeof SellerInterviewStageSchema>;
export type SellerUpdateInput = z.infer<typeof SellerUpdateSchema>;
export type CrmPropertyMinimalInput = z.infer<typeof CrmPropertyMinimalSchema>;
export type CrmPropertyFullInput = z.infer<typeof CrmPropertyFullSchema>;
export type CrmPropertyUpdateInput = z.infer<typeof CrmPropertyUpdateSchema>;

export type CreateBuyerInput = z.infer<typeof CreateBuyerSchema>;
export type CreateShowInput = z.infer<typeof CreateShowSchema>;
export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;
