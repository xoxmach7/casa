export enum SellerFunnelStage {
    CONTACT = 'CONTACT',
    INTERVIEW = 'INTERVIEW',
    STRATEGY = 'STRATEGY',
    CONTRACT_SIGNING = 'CONTRACT_SIGNING',
    CANCELLED = 'CANCELLED',
}

export type CRMMode = 'STANDARD' | 'CUSTOM';

export interface CustomFunnel {
    id: string;
    name: string;
    isActive: boolean;
    stages: CustomStage[];
}

export enum PropertyFunnelStage {
    CREATED = 'CREATED',
    PREPARATION = 'PREPARATION',
    LEADS = 'LEADS',
    SHOWS = 'SHOWS',
    DEAL = 'DEAL',
    SOLD = 'SOLD',
    POST_SERVICE = 'POST_SERVICE',
    CANCELLED = 'CANCELLED',
}

export enum PropertyClass {
    OLD_FUND = 'OLD_FUND',
    ECONOMY = 'ECONOMY',
    COMFORT = 'COMFORT',
    COMFORT_PLUS = 'COMFORT_PLUS',
    BUSINESS = 'BUSINESS',
}

export enum StrategyType {
    MARKET_SALE = 'MARKET_SALE',
    URGENT_SALE = 'URGENT_SALE',
    SALE_TO_PURCHASE = 'SALE_TO_PURCHASE',
    EXPECTATION_ALIGNMENT = 'EXPECTATION_ALIGNMENT',
    LIMITED_ENGAGEMENT = 'LIMITED_ENGAGEMENT',
    INVESTMENT_EXIT = 'INVESTMENT_EXIT',
    LEGAL_COMPLEX = 'LEGAL_COMPLEX',
    LOW_LIQUIDITY = 'LOW_LIQUIDITY',
    ALTERNATIVE_EXIT = 'ALTERNATIVE_EXIT',
    REJECT_OBJECT = 'REJECT_OBJECT',
    HIGH_TICKET_SALE = 'HIGH_TICKET_SALE',
    PRICE_DISCOVERY = 'PRICE_DISCOVERY',
}

export enum LiquidityLevel {
    HIGH = 'HIGH',
    ABOVE_AVERAGE = 'ABOVE_AVERAGE',
    AVERAGE = 'AVERAGE',
    BELOW_AVERAGE = 'BELOW_AVERAGE',
    LOW = 'LOW',
}

export interface CustomStage {
    id: string;
    name: string;
    color: string;
    order: number;
    funnelId?: string;
}

export enum CustomFieldType {
    TEXT = 'TEXT',
    NUMBER = 'NUMBER',
    DATE = 'DATE',
    SELECT = 'SELECT',
    CHECKBOX = 'CHECKBOX',
    TEXTAREA = 'TEXTAREA',
}

export enum CustomFieldEntity {
    SELLER = 'SELLER',
    PROPERTY = 'PROPERTY',
}

export interface CustomField {
    id: string;
    name: string;
    type: CustomFieldType;
    entityType: CustomFieldEntity;
    funnelId?: string | null;
    options: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CustomFieldValue {
    id: string;
    fieldId: string;
    field?: CustomField;
    value: string;
}

export interface Seller {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    trustLevel: number;
    funnelStage: SellerFunnelStage;
    updatedAt: string;
    createdAt: string; // Added for filtering
    customFieldValues?: CustomFieldValue[]; // NEW
    customStageId?: string | null;
    customStage?: CustomStage;
    // Strategy fields
    managerComment?: string;
    reason?: string;
    deadline?: string;
    plansToPurchase?: boolean; // NEW
    strategyConfirmed?: boolean;
    source?: string;
    city?: string;
    broker?: {
        firstName: string;
        lastName: string;
    };
    properties?: {
        id: string;
        residentialComplex: string;
        price: string;
        funnelStage: PropertyFunnelStage;
        repairState?: string;
        ceilingHeight?: string;
        parkingType?: string;
    }[];
    _count?: {
        properties: number;
    };
}

export interface CrmProperty {
    id: string;
    residentialComplex: string;
    address?: string;
    rooms?: number;
    price: string; // Decimal comes as string
    area: string;
    imageUrl?: string;
    documents?: string[]; // NEW for Phase 6

    // Physical specs
    floor?: number;
    totalFloors?: number;
    yearBuilt?: number;
    repairState?: string;
    ceilingHeight?: number; // Changed to number based on likely usage, or string if that's how it comes from DB. Let's check DB schema? DB usually float. But frontend might expect string/number.
    // wait, SummaryDialog expects ceilingHeight to be printed.
    parkingType?: string;
    financeType?: string;

    // Calculated strategy fields
    calculatedClass?: PropertyClass;
    activeStrategy?: StrategyType;
    liquidityLevel?: LiquidityLevel;
    liquidityScore: number;

    // Checklists
    isMortgaged?: boolean; // NEW
    documentsVerified?: boolean; // NEW

    funnelStage: PropertyFunnelStage;
    status?: string; // Property status (ACTIVE, SOLD, ARCHIVED, etc.)
    updatedAt: string;
    createdAt: string; // Added for filtering
    customFieldValues?: CustomFieldValue[]; // NEW
    customStageId?: string | null;
    customStage?: CustomStage;
    strategyExplanation?: string;
    aiRecommendation?: string; // Added Phase 5
    images?: string[]; // Added Phase 2
    notes?: string;

    // === Full Details Fields (Added Phase 2b) ===
    // 3. Constructive
    buildingType?: string; // Enum
    layoutType?: string; // Enum
    elevatorCount?: number;
    hasFreightElevator?: boolean;
    lobbyType?: string; // Enum
    accessSystem?: string; // Enum
    mopState?: string; // Enum
    hasClosedTerritory?: boolean;

    // 6. Condition & Equipment
    furnitureLevel?: string;
    appliancesLevel?: string;
    hasFloorHeating?: boolean;
    hasWalkInCloset?: boolean;
    hasAirConditioning?: boolean;
    hasBuiltInAppliances?: boolean;
    hasPanoramicWindows?: boolean;

    // 8. Financial/Legal
    // isMortgaged already defined above
    mortgageBank?: string;
    mortgageRemaining?: string; // Decimal
    encumbranceType?: string; // Enum
    encumbranceDescription?: string;

    // 9. Extra
    glazingType?: string;
    facadeMaterial?: string;
    parkingSpaces?: number;

    seller?: {
        id: string;
        firstName: string;
        lastName: string;
        phone?: string;
        trustLevel?: number;
    };
    broker?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}
