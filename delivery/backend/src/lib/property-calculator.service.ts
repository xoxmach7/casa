// =========================================
// PROPERTY CALCULATOR SERVICE
// STRICT RULES PER CASA TZ SPECIFICATION
// =========================================

import type {
  PropertyClass,
  LiquidityLevel,
  StrategyType,
  BuildingType,
  RepairState,
  ParkingType,
  LocationQuality,
  LayoutType,
  LobbyType,
  AccessSystemType,
  GlazingType,

  MopState
} from '@prisma/client';
import { deepSeekService, AiStrategyResult } from '../services/deepseek.service';

// =========================================
// TYPES
// =========================================

export interface PropertyClassInput {
  yearBuilt: number;
  buildingType: BuildingType;
  ceilingHeight: number;
  totalFloors: number;
  apartmentsPerFloor: number;
  parkingType: ParkingType;
  hasClosedTerritory: boolean;
  elevatorCount: number;
  hasFreightElevator: boolean;
  locationQuality: LocationQuality;
  // Business-class specific
  glazingType?: GlazingType | null;
  accessSystem?: AccessSystemType | null;
  facadeMaterial?: string | null;
  lobbyType?: LobbyType | null;
}

export interface LiquidityInput {
  calculatedClass: PropertyClass;
  yearBuilt: number;
  floor: number;
  totalFloors: number;
  rooms: number;
  area: number;
  price: number;
  marketPrice?: number | null;
  repairState: RepairState;
  actualCondition: string; // EXCELLENT, GOOD, NEEDS_INVESTMENT, CRITICAL
  parkingType: ParkingType;
  viewType?: string | null;
  mopState?: MopState | null;
  layoutType: LayoutType;
  isCorner: boolean;
  hasBalcony: boolean;
  financeType: string;
  locationQuality: LocationQuality;
  elevatorCount: number;
  furnitureLevel?: string | null; // NONE, PARTIAL, FULL
}

export interface StrategyInput {
  seller: {
    reason?: string | null;
    deadline?: string | null;
    expectedPrice?: number | null;
    minPrice?: number | null;
    hasDebts: boolean;
    readyForExclusive: boolean;
    trustLevel: number;
    readyToFollowRecommendations?: string | null; // YES, PARTIAL, NO
    plansToPurchase?: boolean; // NEW: флаг, что продавец планирует покупку после продажи
  };
  property: {
    calculatedClass: PropertyClass;
    liquidityLevel: LiquidityLevel;
    liquidityScore: number;
    price: number;
    marketPrice?: number | null;
    financeType: string;
    hasLegalIssues: boolean; // залог, обременения, доли, наследство
    legalIssueType?: string | null;
    isMortgaged?: boolean; // New: залог
  };
}

// =========================================
// 1. PROPERTY CLASS CALCULATOR
// STRICT HIERARCHICAL LOGIC: OLD_FUND → BUSINESS → COMFORT_PLUS → COMFORT → ECONOMY
// =========================================

export function calculatePropertyClass(input: PropertyClassInput): PropertyClass {
  // =========================================
  // RULE 1: СТАРФОНД (HARD RULE - FIRST CHECK)
  // Год постройки <= 1980 → АВТОМАТИЧЕСКИ СТАРФОНД
  // Никакие другие параметры не могут повысить класс
  // =========================================
  if (input.yearBuilt <= 1980) {
    return 'OLD_FUND';
  }

  // =========================================
  // RULE 2: БИЗНЕС-КЛАСС (ALL 13 CONDITIONS REQUIRED)
  // Невыполнение ХОТЯ БЫ ОДНОГО условия → НЕ БИЗНЕС
  // =========================================
  const businessChecks = checkBusinessClass(input);
  if (businessChecks.passed) {
    return 'BUSINESS';
  }

  // =========================================
  // RULE 3: КОМФОРТ+ (ALL 8 CONDITIONS REQUIRED)
  // =========================================
  const comfortPlusChecks = checkComfortPlusClass(input);
  if (comfortPlusChecks.passed) {
    return 'COMFORT_PLUS';
  }

  // =========================================
  // RULE 4: КОМФОРТ (ALL 6 CONDITIONS REQUIRED)
  // =========================================
  const comfortChecks = checkComfortClass(input);
  if (comfortChecks.passed) {
    return 'COMFORT';
  }

  // =========================================
  // DEFAULT: ЭКОНОМ
  // Все остальные объекты
  // =========================================
  return 'ECONOMY';
}

interface ClassCheckResult {
  passed: boolean;
  failedConditions: string[];
}

/**
 * БИЗНЕС-КЛАСС: ВСЕ 13 условий обязательны
 * Из ТЗ раздел 3.2.5
 */
function checkBusinessClass(input: PropertyClassInput): ClassCheckResult {
  const failedConditions: string[] = [];

  // 1. Год постройки >= 2015
  if (input.yearBuilt < 2015) {
    failedConditions.push('yearBuilt >= 2015');
  }

  // 2. Тип дома: Кирпич или монолит
  if (!['BRICK', 'MONOLITH', 'MONOLITH_BRICK'].includes(input.buildingType)) {
    failedConditions.push('buildingType = BRICK or MONOLITH');
  }

  // 3. Локация: Топ-локация
  if (input.locationQuality !== 'TOP') {
    failedConditions.push('locationQuality = TOP');
  }

  // 4. Высота потолков >= 3.2 м
  if (input.ceilingHeight < 3.2) {
    failedConditions.push('ceilingHeight >= 3.2m');
  }

  // 5. Этажность дома <= 9
  if (input.totalFloors > 9) {
    failedConditions.push('totalFloors <= 9');
  }

  // 6. Квартир на площадке <= 4
  if (input.apartmentsPerFloor > 4) {
    failedConditions.push('apartmentsPerFloor <= 4');
  }

  // 7. Паркинг: Подземный (ОБЯЗАТЕЛЬНО)
  if (input.parkingType !== 'UNDERGROUND') {
    failedConditions.push('parkingType = UNDERGROUND');
  }

  // 8. Тип остекления: Панорамное или увеличенное
  if (!input.glazingType || !['PANORAMIC', 'ENLARGED'].includes(input.glazingType)) {
    failedConditions.push('glazingType = PANORAMIC or ENLARGED');
  }

  // 9. Система доступа: Face ID / smart-access
  if (!input.accessSystem || !['FACE_ID', 'SMART_ACCESS'].includes(input.accessSystem)) {
    failedConditions.push('accessSystem = FACE_ID or SMART_ACCESS');
  }

  // 10. Лифты >= 2 или наличие грузового
  if (input.elevatorCount < 2 && !input.hasFreightElevator) {
    failedConditions.push('elevatorCount >= 2 OR hasFreightElevator');
  }

  // 11. Закрытая территория: ОБЯЗАТЕЛЬНА
  if (!input.hasClosedTerritory) {
    failedConditions.push('hasClosedTerritory = true');
  }

  // 12. Облицовка фасада: Премиум (керамогранит, камень, клинкер)
  const premiumFacades = ['CERAMIC_GRANITE', 'STONE', 'CLINKER', 'PREMIUM'];
  if (!input.facadeMaterial || !premiumFacades.includes(input.facadeMaterial.toUpperCase())) {
    failedConditions.push('facadeMaterial = PREMIUM');
  }

  // 13. Холл (лобби): Современный дизайн, консьерж / ресепшн
  if (!input.lobbyType || !['PREMIUM', 'MODERN'].includes(input.lobbyType)) {
    failedConditions.push('lobbyType = PREMIUM or MODERN');
  }

  return {
    passed: failedConditions.length === 0,
    failedConditions,
  };
}

/**
 * КОМФОРТ+: ВСЕ 8 условий обязательны
 * Из ТЗ раздел 3.2.4
 */
function checkComfortPlusClass(input: PropertyClassInput): ClassCheckResult {
  const failedConditions: string[] = [];

  // 1. Год постройки >= 2010
  if (input.yearBuilt < 2010) {
    failedConditions.push('yearBuilt >= 2010');
  }

  // 2. Тип дома: Кирпич или монолит
  if (!['BRICK', 'MONOLITH', 'MONOLITH_BRICK'].includes(input.buildingType)) {
    failedConditions.push('buildingType = BRICK or MONOLITH');
  }

  // 3. Высота потолков 3.0–3.19 м
  if (input.ceilingHeight < 3.0 || input.ceilingHeight >= 3.2) {
    failedConditions.push('ceilingHeight >= 3.0m and < 3.2m');
  }

  // 4. Этажность дома <= 12
  if (input.totalFloors > 12) {
    failedConditions.push('totalFloors <= 12');
  }

  // 5. Лифты >= 2 или (1 пассажирский + 1 грузовой)
  if (input.elevatorCount < 2 && !input.hasFreightElevator) {
    failedConditions.push('elevatorCount >= 2 OR hasFreightElevator');
  }

  // 6. Локация: Хорошая или выше средней
  if (!['TOP', 'GOOD', 'ABOVE_AVERAGE'].includes(input.locationQuality)) {
    failedConditions.push('locationQuality >= GOOD');
  }

  // 7. Паркинг: Обязателен (подземный или закрытый наземный)
  if (!['UNDERGROUND', 'ABOVE_GROUND'].includes(input.parkingType)) {
    failedConditions.push('parkingType = UNDERGROUND or ABOVE_GROUND');
  }

  // 8. Закрытая территория: ОБЯЗАТЕЛЬНА
  if (!input.hasClosedTerritory) {
    failedConditions.push('hasClosedTerritory = true');
  }

  return {
    passed: failedConditions.length === 0,
    failedConditions,
  };
}

/**
 * КОМФОРТ: ВСЕ 6 условий обязательны
 * Из ТЗ раздел 3.2.3
 */
function checkComfortClass(input: PropertyClassInput): ClassCheckResult {
  const failedConditions: string[] = [];

  // 1. Год постройки >= 1998
  if (input.yearBuilt < 1998) {
    failedConditions.push('yearBuilt >= 1998');
  }

  // 2. Тип дома: Кирпич, монолит или панель
  if (!['BRICK', 'MONOLITH', 'MONOLITH_BRICK', 'PANEL'].includes(input.buildingType)) {
    failedConditions.push('buildingType = BRICK, MONOLITH or PANEL');
  }

  // 3. Высота потолков 2.6–2.99 м
  if (input.ceilingHeight < 2.6 || input.ceilingHeight >= 3.0) {
    failedConditions.push('ceilingHeight >= 2.6m and < 3.0m');
  }

  // 4. Этажность дома <= 20
  if (input.totalFloors > 20) {
    failedConditions.push('totalFloors <= 20');
  }

  // 5. Лифты >= 1
  if (input.elevatorCount < 1) {
    failedConditions.push('elevatorCount >= 1');
  }

  // 6. Локация: Нормальная или развитая
  if (['WEAK', 'REMOTE'].includes(input.locationQuality)) {
    failedConditions.push('locationQuality >= NORMAL');
  }

  return {
    passed: failedConditions.length === 0,
    failedConditions,
  };
}

// =========================================
// 2. LIQUIDITY CALCULATOR
// HARD TRIGGERS FIRST, THEN SOFT SCORING
// =========================================

export interface LiquidityResult {
  score: number;
  level: LiquidityLevel;
  isIlliquid: boolean;
  hardTrigger?: string;
}

export function calculateLiquidityScore(input: LiquidityInput): LiquidityResult {
  // =========================================
  // STEP 1: HARD TRIGGERS (АВТОМАТИЧЕСКИЙ НЕЛИКВИД)
  // Из ТЗ раздел 5.2 A) Hard-триггеры
  // Если срабатывает любой → LOW, баллы не считаем
  // =========================================

  // 1. Локация критическая (Слабая или Удалённая)
  if (['WEAK', 'REMOTE'].includes(input.locationQuality)) {
    return {
      score: 10,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'CRITICAL_LOCATION',
    };
  }

  // UPD: Старый фонд не приговор, если в центре или цена ок.
  // Пока оставим, но снизим жесткость.
  // 2. Старый фонд (yearBuilt <= 1980)
  /* 
  // REMOVED HARD TRIGGER FOR OLD FUND. Let soft scoring handle it.
  if (input.yearBuilt <= 1980) {
    return {
      score: 15,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'OLD_FUND',
    };
  } 
  */

  // 3. Критическое состояние квартиры
  if (input.actualCondition === 'CRITICAL') {
    return {
      score: 10,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'CRITICAL_CONDITION',
    };
  }

  // 4. Лифты = 0 И этажность > 5
  if (input.elevatorCount === 0 && input.totalFloors > 5) {
    return {
      score: 15,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'NO_ELEVATOR_HIGH_RISE',
    };
  }

  // 5. МОП = Критическое состояние
  if (input.mopState === 'CRITICAL') {
    return {
      score: 15,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'CRITICAL_MOP',
    };
  }

  // 6. Критически проблемная планировка (Проходные комнаты)
  if (input.layoutType === 'WALK_THROUGH') {
    return {
      score: 20,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'WALK_THROUGH_LAYOUT',
    };
  }

  // 7. Микростудия (Студия < 30 м²)
  if (input.layoutType === 'STUDIO' && input.area < 30) {
    return {
      score: 20,
      level: 'LOW',
      isIlliquid: true,
      hardTrigger: 'MICRO_STUDIO',
    };
  }

  // =========================================
  // STEP 2: SOFT SCORING (для прошедших хард-фильтры)
  // =========================================

  let score = 50; // Базовый балл

  // === ПОЛОЖИТЕЛЬНЫЕ ФАКТОРЫ ===

  // Класс объекта
  const classBonus: Record<PropertyClass, number> = {
    'BUSINESS': 20,
    'COMFORT_PLUS': 15,
    'COMFORT': 10,
    'ECONOMY': 0,
    'OLD_FUND': -15, // не должен сюда попасть, но на всякий случай
  };
  score += classBonus[input.calculatedClass] || 0;

  // Год постройки
  if (input.yearBuilt >= 2020) score += 10;
  else if (input.yearBuilt >= 2015) score += 7;
  else if (input.yearBuilt >= 2010) score += 5;
  else if (input.yearBuilt >= 2000) score += 2;
  else if (input.yearBuilt < 1990) score -= 5;
  // Soft scoring for Old Fund instead of Hard Trigger
  if (input.yearBuilt <= 1980) score -= 15;

  // Этаж (средние этажи лучше)
  const floorRatio = input.floor / input.totalFloors;
  if (input.floor === 1) score -= 7;  // Первый этаж — существенный минус
  else if (input.floor === input.totalFloors) score -= 4;  // Последний этаж
  else if (floorRatio >= 0.25 && floorRatio <= 0.75) score += 5;  // Средние этажи

  // Комнатность (1-3 самые ликвидные)
  if (input.rooms >= 1 && input.rooms <= 3) score += 5;
  else if (input.rooms >= 4) score -= 3;

  // Ремонт
  const repairBonus: Record<string, number> = {
    'DESIGNER': 10,
    'EURO': 7,
    'CAPITAL': 5,
    'COSMETIC': 2,
    'WHITE_FRAME': 0,
    'BLACK_FRAME': -3,
    'NEEDS_REPAIR': -10,
  };
  score += repairBonus[input.repairState] || 0;

  // Паркинг
  if (input.parkingType === 'UNDERGROUND') score += 8;
  else if (input.parkingType === 'ABOVE_GROUND') score += 4;
  else if (input.parkingType === 'OPEN') score += 1;
  else if (input.parkingType === 'NONE') score -= 5;

  // Вид из окна
  const viewBonus: Record<string, number> = {
    'PANORAMIC': 8,
    'PARK': 6,
    'PARK_WATER': 6,
    'MOUNTAINS': 6,
    'CITY_CENTER': 5,
    'COURTYARD': 2,
    'STREET': 0,
    'ADJACENT_BUILDINGS': -2,
    'WELL_COURTYARD': -5,
    'INDUSTRIAL': -8,
  };
  if (input.viewType) score += viewBonus[input.viewType] || 0;

  // МОП
  const mopBonus: Record<string, number> = {
    'EXCELLENT': 5,
    'GOOD': 3,
    'SATISFACTORY': 0,
    'NEEDS_REPAIR': -5,
    'CRITICAL': -10, // не попадёт сюда из-за hard trigger
  };
  if (input.mopState) score += mopBonus[input.mopState] || 0;

  // Мебель и Ремонт (New Logic)
  // Если ремонт требует вложений (NONE - черновая) И нет мебели -> существенный минус
  if (input.repairState === 'NONE' &&
    (!input.furnitureLevel || input.furnitureLevel === 'NONE')) {
    score -= 8;
  }
  // Бонус за полную мебелировку
  if (input.furnitureLevel === 'FULL') score += 5;

  // === ОТРИЦАТЕЛЬНЫЕ ФАКТОРЫ ===

  if (input.isCorner) score -= 3;  // Угловая квартира
  if (!input.hasBalcony) score -= 3;  // Нет балкона

  // Финансирование
  if (input.financeType === 'CASH_ONLY') score -= 12;
  else if (input.financeType === 'MORTGAGE_LIMITED') score -= 6;

  // Цена относительно рынка
  if (input.marketPrice && input.price > input.marketPrice * 1.15) {
    score -= 10;  // Завышена более чем на 15%
  } else if (input.marketPrice && input.price <= input.marketPrice * 1.05) {
    // UPD: Если цена в рынке (до +5%) или ниже - даем бонус, чтобы вытащить из ямы
    score += 10;
  }

  // =========================================
  // STEP 3: ОПРЕДЕЛЕНИЕ УРОВНЯ ЛИКВИДНОСТИ
  // =========================================

  // Ограничиваем 0-100
  score = Math.max(0, Math.min(100, score));

  let level: LiquidityLevel;
  if (score >= 81) level = 'HIGH';
  else if (score >= 61) level = 'ABOVE_AVERAGE';
  else if (score >= 41) level = 'AVERAGE';
  else if (score >= 21) level = 'BELOW_AVERAGE';
  else level = 'LOW';

  return {
    score,
    level,
    isIlliquid: level === 'LOW',
  };
}

// =========================================
// 3. STRATEGY CALCULATOR
// STRICT PRIORITY ORDER (BLOCKING → CORRECTIVE → BASE)
// =========================================

export function calculateStrategy(input: StrategyInput): StrategyType {
  const { seller, property } = input;

  // =========================================
  // PRIORITY 1: REJECT_OBJECT (S10) — ПОЛНЫЙ ОТКАЗ
  // Блокирующая стратегия высшего приоритета
  // =========================================

  // Критические условия для отказа:
  // - Нет доверия (trustLevel <= 1)
  // - Продавец не готов следовать рекомендациям
  // - Low liquidity + Cash only (неликвид без ипотеки)
  // - Юридические проблемы + низкий траст

  if (seller.trustLevel <= 1) {
    return 'REJECT_OBJECT';
  }

  if (seller.readyToFollowRecommendations === 'NO' && !seller.readyForExclusive) {
    return 'REJECT_OBJECT';
  }

  if (property.liquidityLevel === 'LOW' && property.financeType === 'CASH_ONLY') {
    // Неликвид + только наличные = Casa не берёт
    return 'REJECT_OBJECT';
  }

  // =========================================
  // PRIORITY 2: LEGAL_COMPLEX (S7) — ЮРИДИЧЕСКИЕ ПРОБЛЕМЫ
  // Сначала чистим документы, потом продаём
  // =========================================

  if (property.hasLegalIssues || property.isMortgaged) {
    // Залог (isMortgaged), обременения, доли, наследство
    return 'LEGAL_COMPLEX';
  }

  // =========================================
  // PRIORITY 3: EXPECTATION_ALIGNMENT (S4) — ЗАВЫШЕННЫЕ ОЖИДАНИЯ
  // Сначала лечим цену, потом продаём
  // =========================================

  if (property.marketPrice && seller.expectedPrice) {
    const overpriceRatio = seller.expectedPrice / property.marketPrice;
    if (overpriceRatio > 1.10) {
      // Цена завышена более чем на 10%
      return 'EXPECTATION_ALIGNMENT';
    }
  }

  // =========================================
  // PRIORITY 4: LOW_LIQUIDITY (S8) — НИЗКАЯ ЛИКВИДНОСТЬ
  // Объект с объективно слабым спросом
  // =========================================

  // UPD: Ловушка Неликвида. Теперь срабатываем ТОЛЬКО если ликвидность LOW (безнадежно).
  // BELOW_AVERAGE даем шанс быть MARKET_SALE или PRICE_DISCOVERY.
  // И!!! Если цена ХОРОШАЯ (ниже рынка), то это не Low Liquidity, это Срочная/Рыночная.
  const isGoodPrice = property.marketPrice && property.price <= property.marketPrice * 0.98;

  if (!isGoodPrice && property.liquidityLevel === 'LOW') {
    return 'LOW_LIQUIDITY';
  }

  // =========================================
  // PRIORITY 5: LIMITED_ENGAGEMENT (S5) — ОГРАНИЧЕННОЕ ВОВЛЕЧЕНИЕ
  // Нет эксклюзива или продавец сомневается
  // =========================================

  // Убираем стратегию LIMITED_ENGAGEMENT при "частичном доверии".
  // Лучше пусть будет Рыночная, но с флагом риска, чем "Ограниченное вовлечение" (путает юзера).
  // Оставляем только если реально низкий траст и нет эксклюзива.
  if (!seller.readyForExclusive && seller.trustLevel <= 2) {
    return 'LIMITED_ENGAGEMENT';
  }

  if (seller.readyToFollowRecommendations === 'PARTIAL') {
    return 'LIMITED_ENGAGEMENT';
  }

  // =========================================
  // PRIORITY 6: URGENT_SALE (S2) — СРОЧНАЯ ПРОДАЖА
  // =========================================

  if (seller.deadline === 'URGENT_30_DAYS') {
    return 'URGENT_SALE';
  }

  // Финансовая необходимость + долги = срочность
  if (seller.reason === 'FINANCIAL_NEED' && seller.hasDebts) {
    return 'URGENT_SALE';
  }

  // UPD: Срочность + Долги (любой дедлайн, если есть долги и маркер срочности)
  if (seller.hasDebts && (seller.deadline === 'URGENT_30_DAYS' || seller.deadline === 'NORMAL_90_DAYS')) {
    return 'URGENT_SALE';
  }

  // =========================================
  // PRIORITY 7: INVESTMENT_EXIT (S6) — ИНВЕСТИЦИОННАЯ ПРОДАЖА
  // =========================================

  if (seller.reason === 'INVESTMENT') {
    return 'INVESTMENT_EXIT';
  }

  // =========================================
  // PRIORITY 8: SALE_TO_PURCHASE (S3) — ПРОДАЖА → ПОКУПКА
  // =========================================

  if (seller.plansToPurchase || seller.reason === 'SIZE_CHANGE' || seller.reason === 'RELOCATION') {
    return 'SALE_TO_PURCHASE';
  }

  // =========================================
  // PRIORITY 9: HIGH_TICKET_SALE (S11) — ДОРОГОЙ ОБЪЕКТ
  // =========================================

  if (property.calculatedClass === 'BUSINESS') {
    return 'HIGH_TICKET_SALE';
  }

  // Высокий чек (например, > 150M тенге)
  if (property.price >= 150_000_000) {
    return 'HIGH_TICKET_SALE';
  }

  // =========================================
  // DEFAULT: MARKET_SALE (S1) — РЫНОЧНАЯ ПРОДАЖА
  // Стандартная стратегия для всех остальных
  // =========================================

  return 'MARKET_SALE';
}

// =========================================
// HELPER: Get strategy explanation
// =========================================

export function getStrategyExplanation(strategy: StrategyType): string {
  const explanations: Record<StrategyType, string> = {
    'MARKET_SALE': 'Продажа по рыночной цене в стандартные сроки',
    'URGENT_SALE': 'Срочная продажа с приоритетом скорости',
    'SALE_TO_PURCHASE': 'Продажа связана с последующей покупкой',
    'EXPECTATION_ALIGNMENT': 'Требуется корректировка ценовых ожиданий',
    'LIMITED_ENGAGEMENT': 'Ограниченное вовлечение Casa до подтверждения готовности',
    'INVESTMENT_EXIT': 'Инвестиционная продажа с аналитическим подходом',
    'LEGAL_COMPLEX': 'Требуется юридическая проработка перед продажей',
    'LOW_LIQUIDITY': 'Объект с ограниченным спросом — реалистичные сроки',
    'ALTERNATIVE_EXIT': 'Альтернативный сценарий из-за ограничений',
    'REJECT_OBJECT': 'Отказ от объекта по критериям Casa',
    'HIGH_TICKET_SALE': 'Дорогой объект — индивидуальный подход',
    'PRICE_DISCOVERY': 'Тестирование цены рынком',
  };

  return explanations[strategy] || 'Стратегия не определена';
}

// =========================================
// FULL CALCULATION PIPELINE
// =========================================

export interface FullCalculationResult {
  propertyClass: PropertyClass;
  liquidityResult: LiquidityResult;
  strategy: StrategyType;
  strategyExplanation: string;
  financeType: 'MORTGAGE_AVAILABLE' | 'MORTGAGE_LIMITED' | 'CASH_ONLY';
}

export function calculatePropertyClassification(
  propertyInput: PropertyClassInput,
  liquidityInput: Omit<LiquidityInput, 'calculatedClass'>,
  strategyInput: Omit<StrategyInput, 'property'> & { property: Omit<StrategyInput['property'], 'calculatedClass' | 'liquidityLevel' | 'liquidityScore'> }
): FullCalculationResult {

  // Step 1: Calculate property class
  const propertyClass = calculatePropertyClass(propertyInput);

  // Step 2: Determine finance type
  let financeType: 'MORTGAGE_AVAILABLE' | 'MORTGAGE_LIMITED' | 'CASH_ONLY' = 'MORTGAGE_AVAILABLE';

  if (propertyClass === 'OLD_FUND') {
    financeType = propertyInput.yearBuilt < 1970 ? 'CASH_ONLY' : 'MORTGAGE_LIMITED';
  } else if (propertyInput.elevatorCount === 0 && propertyInput.totalFloors > 5) {
    financeType = 'MORTGAGE_LIMITED';
  }

  // Step 3: Calculate liquidity
  const liquidityResult = calculateLiquidityScore({
    ...liquidityInput,
    calculatedClass: propertyClass,
    financeType,
  });

  // Step 4: Calculate strategy
  const strategy = calculateStrategy({
    seller: strategyInput.seller,
    property: {
      ...strategyInput.property,
      calculatedClass: propertyClass,
      liquidityLevel: liquidityResult.level,
      liquidityScore: liquidityResult.score,
      financeType,
    },
  });

  return {
    propertyClass,
    liquidityResult,
    strategy,
    strategyExplanation: getStrategyExplanation(strategy),
    financeType,
  };
}


// =========================================
// 4. HYBRID AI STRATEGY (MATH + DEEPSEEK)
// =========================================
export interface HybridCalculationResult extends FullCalculationResult {
  aiReasoning?: string;
  isAiAdjusted: boolean;
}

export async function calculateHybridStrategy(
  propertyInput: PropertyClassInput,
  liquidityInput: Omit<LiquidityInput, 'calculatedClass'>,
  strategyInput: Omit<StrategyInput, 'property'> & { property: Omit<StrategyInput['property'], 'calculatedClass' | 'liquidityLevel' | 'liquidityScore'> }
): Promise<HybridCalculationResult> {

  // 1. Run Math Model
  const mathResult = calculatePropertyClassification(propertyInput, liquidityInput, strategyInput);

  // 2. Determine if we need AI intervention
  // We don't ask AI if it's a Hard Reject (REJECT_OBJECT) or if API key is missing.
  if (mathResult.strategy === 'REJECT_OBJECT') {
    return { ...mathResult, isAiAdjusted: false };
  }

  // 3. Prepare context for AI
  const aiContext = {
    address: "Адрес скрыт", // Privacy
    residentialComplex: "ЖК " + (propertyInput.buildingType || "Не указан"),
    price: liquidityInput.price,
    area: liquidityInput.area,
    floor: liquidityInput.floor,
    totalFloors: liquidityInput.totalFloors,
    yearBuilt: propertyInput.yearBuilt,
    repairState: liquidityInput.repairState,
    calculatedClass: mathResult.propertyClass,
    liquidityScore: mathResult.liquidityResult.score,
    activeStrategy: mathResult.strategy // The Math opinion
  };

  // 4. Ask DeepSeek
  const aiDecision: AiStrategyResult = await deepSeekService.determineStrategy(aiContext);

  // 5. Apply AI Decision (Override if different)
  const isAiAdjusted = aiDecision.finalStrategy !== mathResult.strategy;

  return {
    ...mathResult,
    strategy: aiDecision.finalStrategy as StrategyType,
    strategyExplanation: getStrategyExplanation(aiDecision.finalStrategy as StrategyType), // Update explanation
    liquidityResult: {
      ...mathResult.liquidityResult,
      score: aiDecision.liquidityScore // AI can adjust score
    },
    aiReasoning: aiDecision.reasoning,
    isAiAdjusted
  };
}
