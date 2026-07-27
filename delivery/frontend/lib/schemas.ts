import { z } from "zod";
import { SellerFunnelStage, PropertyFunnelStage } from "@/types/kanban";

export const createSellerSchema = z.object({
    // === 1. Основная информация о продавце ===
    firstName: z.string().min(2, "Имя слишком короткое"),
    lastName: z.string().min(2, "Фамилия слишком короткая"),
    phone: z.preprocess(
        // Нормализация номера: убираем пробелы, скобки, тире
        (val) => {
            if (typeof val === 'string') {
                return val.replace(/[\s\-\(\)]/g, '');
            }
            return val;
        },
        z.string().regex(/^(\+?7|8)?[0-9]{10}$/, "Некорректный формат телефона")
    ),
    city: z.string().optional(),
    source: z.string().optional(),
    managerComment: z.string().optional(),

    // === 2. Причина продажи и срочность ===
    reason: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.enum(["SIZE_CHANGE", "RELOCATION", "INVESTMENT", "DIVORCE", "INHERITANCE", "FINANCIAL_NEED", "OTHER"]).optional()),
    reasonOther: z.string().optional(),
    deadline: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.enum(["URGENT_30_DAYS", "NORMAL_90_DAYS", "FLEXIBLE_180_DAYS", "NO_RUSH"]).optional()),

    // === 3. Ценовые ожидания ===
    expectedPrice: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.coerce.number().positive("Цена должна быть положительной").optional()),
    minPrice: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.coerce.number().positive("Цена должна быть положительной").optional()),
    readyToNegotiate: z.boolean().default(true),
    marketAssessment: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.enum(["ADEQUATE", "OVERPRICED", "UNCERTAIN"]).optional()),

    // === 4. Планы и Финансы ===
    plansToPurchase: z.boolean().default(false),
    nextPurchaseFormat: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.enum(["NEW_BUILDING", "SECONDARY", "HOUSE", "NOT_DECIDED"]).optional()),
    purchaseBudget: z.preprocess(val => (val === "" || val === null || val === undefined || val === 0) ? undefined : val, z.coerce.number().positive("Бюджет должен быть положительным").optional()),
    incomeSource: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.enum(["EMPLOYMENT", "BUSINESS", "RENTAL_INCOME", "PENSION", "OTHER"]).optional()),
    hasDebts: z.boolean().default(false),
    loanPaymentAmount: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.coerce.number().optional()),

    // === 5. Коммуникация ===
    communicationChannel: z.string().optional(),
    preferredTime: z.string().optional(),

    // === Legacy fields ===
    trustLevel: z.number().min(1).max(5).default(3),
    readyToFollowRecommendations: z.preprocess(val => (val === "" || val === null || val === undefined) ? undefined : val, z.enum(["YES", "PARTIAL", "NO"]).optional()),
    readyForExclusive: z.boolean().default(false),
    customStageId: z.string().optional(),
    projectId: z.string().optional(),
    apartmentId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.reason === "OTHER" && (!data.reasonOther || data.reasonOther.length < 2)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Укажите причину",
            path: ["reasonOther"]
        });
    }
});

export type CreateSellerValues = z.infer<typeof createSellerSchema>;

export const createPropertySchema = z.object({
    // === 1. Основные характеристики ===
    residentialComplex: z.string().min(2, "Укажите название ЖК"),
    district: z.string().min(2, "Укажите район"),
    address: z.string().min(5, "Адрес слишком короткий"),
    rooms: z.coerce.number().min(1, "Минимум 1 комната").max(10),
    area: z.coerce.number().min(10, "Минимальная площадь 10 м²"),
    floor: z.coerce.number().min(-1, "Этаж"),
    totalFloors: z.coerce.number().min(1, "Всего этажей"),
    yearBuilt: z.coerce.number().min(1900, "Год постройки неверный").max(new Date().getFullYear() + 5),

    // === 2. Дом и параметры ===
    buildingType: z.enum(["BRICK", "MONOLITH", "PANEL", "BLOCK", "MONOLITH_BRICK"]).default("MONOLITH"),
    elevatorCount: z.coerce.number().min(0).default(0),
    kitchenArea: z.coerce.number().optional(),
    ceilingHeight: z.coerce.number().min(2.0, "Потолок слишком низкий").max(5.0).default(2.7),
    bathroomType: z.string().optional(),
    balconyType: z.string().optional(),

    // === 3. Ремонт и состояние ===
    repairState: z.enum(["NONE", "COSMETIC", "CAPITAL", "EURO", "DESIGNER"]).default("COSMETIC"),
    actualCondition: z.enum(["EXCELLENT", "GOOD", "NEEDS_INVESTMENT", "CRITICAL"]).default("GOOD"),

    // === 4. Залог и обременения ===
    isMortgaged: z.boolean().default(false),
    mortgageBank: z.string().optional(),
    mortgageRemaining: z.coerce.number().optional(),
    mortgageRemovalMethod: z.string().optional(),
    encumbranceType: z.enum(["NONE", "SHARES", "ENCUMBRANCE", "INHERITANCE", "POWER_OF_ATTORNEY"]).default("NONE"),

    // === 5. Опции и удобства ===
    hasPanoramicWindows: z.boolean().default(false),
    hasFloorHeating: z.boolean().default(false),
    hasClosedTerritory: z.boolean().default(false),
    hasWalkInCloset: z.boolean().default(false),
    hasAirConditioning: z.boolean().default(false),
    hasBuiltInAppliances: z.boolean().default(false),
    furnitureLevel: z.enum(["NONE", "PARTIAL", "FULL"]).default("NONE"),
    appliancesLevel: z.enum(["NONE", "PARTIAL", "FULL"]).default("NONE"),

    // === 6. Публикации ===
    krishaUrl: z.string().optional(),
    knUrl: z.string().optional(),
    olxUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    tikTokUrl: z.string().optional(),

    // === 7. Документы (Metadata) ===
    documentsVerified: z.boolean().default(false),

    // === Hidden / System ===
    sellerId: z.string(),
    price: z.coerce.number().min(1000000, "Минимальная цена 1 млн"),
    funnelStage: z.nativeEnum(PropertyFunnelStage).default(PropertyFunnelStage.CREATED),
});

export type CreatePropertyValues = z.infer<typeof createPropertySchema>;
