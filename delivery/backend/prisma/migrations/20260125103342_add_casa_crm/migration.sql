-- CreateEnum
CREATE TYPE "PropertyClass" AS ENUM ('OLD_FUND', 'ECONOMY', 'COMFORT', 'COMFORT_PLUS', 'BUSINESS');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('MARKET_SALE', 'URGENT_SALE', 'SALE_TO_PURCHASE', 'EXPECTATION_ALIGNMENT', 'LIMITED_ENGAGEMENT', 'INVESTMENT_EXIT', 'LEGAL_COMPLEX', 'LOW_LIQUIDITY', 'ALTERNATIVE_EXIT', 'REJECT_OBJECT', 'HIGH_TICKET_SALE', 'PRICE_DISCOVERY');

-- CreateEnum
CREATE TYPE "LiquidityLevel" AS ENUM ('HIGH', 'ABOVE_AVERAGE', 'AVERAGE', 'BELOW_AVERAGE', 'LOW');

-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('MORTGAGE_AVAILABLE', 'MORTGAGE_LIMITED', 'CASH_ONLY');

-- CreateEnum
CREATE TYPE "SellerFunnelStage" AS ENUM ('CONTACT', 'INTERVIEW', 'STRATEGY', 'CONTRACT_SIGNING');

-- CreateEnum
CREATE TYPE "PropertyFunnelStage" AS ENUM ('CREATED', 'PREPARATION', 'LEADS', 'SHOWS', 'DEAL', 'POST_SERVICE');

-- CreateEnum
CREATE TYPE "SaleReason" AS ENUM ('RELOCATION', 'SIZE_CHANGE', 'INHERITANCE', 'DIVORCE', 'FINANCIAL_NEED', 'INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleDeadline" AS ENUM ('URGENT_30_DAYS', 'NORMAL_90_DAYS', 'FLEXIBLE_180_DAYS', 'NO_RUSH');

-- CreateEnum
CREATE TYPE "MarketAssessment" AS ENUM ('ADEQUATE', 'OVERPRICED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ReadyToFollow" AS ENUM ('YES', 'PARTIAL', 'NO');

-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('MONOLITH', 'BRICK', 'PANEL', 'MONOLITH_BRICK', 'BLOCK');

-- CreateEnum
CREATE TYPE "LayoutType" AS ENUM ('EURO_FREE', 'ISOLATED', 'ADJACENT', 'WALK_THROUGH', 'STUDIO');

-- CreateEnum
CREATE TYPE "RepairState" AS ENUM ('NONE', 'COSMETIC', 'CAPITAL', 'EURO', 'DESIGNER');

-- CreateEnum
CREATE TYPE "ActualCondition" AS ENUM ('EXCELLENT', 'GOOD', 'NEEDS_INVESTMENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ParkingType" AS ENUM ('UNDERGROUND', 'ABOVE_GROUND', 'OPEN', 'NONE');

-- CreateEnum
CREATE TYPE "LocationQuality" AS ENUM ('TOP', 'GOOD', 'ABOVE_AVERAGE', 'NORMAL', 'WEAK', 'REMOTE');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('PANORAMIC', 'PARK_WATER', 'STREET', 'COURTYARD', 'WELL_COURTYARD', 'ADJACENT_BUILDINGS', 'INDUSTRIAL');

-- CreateEnum
CREATE TYPE "LobbyType" AS ENUM ('PREMIUM', 'MODERN', 'STANDARD', 'SIMPLE', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "AccessSystemType" AS ENUM ('FACE_ID', 'SMART_ACCESS', 'ELECTRONIC_CARD', 'INTERCOM', 'CODE_LOCK', 'KEY');

-- CreateEnum
CREATE TYPE "MopState" AS ENUM ('EXCELLENT', 'GOOD', 'SATISFACTORY', 'NEEDS_REPAIR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EncumbranceType" AS ENUM ('NONE', 'SHARES', 'ENCUMBRANCE', 'INHERITANCE', 'POWER_OF_ATTORNEY');

-- CreateEnum
CREATE TYPE "GlazingType" AS ENUM ('PANORAMIC', 'ENLARGED', 'STANDARD');

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "iin" TEXT,
    "reason" "SaleReason",
    "reason_other" TEXT,
    "deadline" "SaleDeadline",
    "expected_price" DECIMAL(15,2),
    "min_price" DECIMAL(15,2),
    "market_assessment" "MarketAssessment",
    "ready_to_negotiate" BOOLEAN NOT NULL DEFAULT true,
    "plans_to_purchase" BOOLEAN NOT NULL DEFAULT false,
    "plans_mortgage" BOOLEAN NOT NULL DEFAULT false,
    "next_purchase_format" TEXT,
    "purchase_budget" DECIMAL(15,2),
    "income_source" TEXT,
    "income_amount" DECIMAL(15,2),
    "has_debts" BOOLEAN NOT NULL DEFAULT false,
    "ready_to_follow" "ReadyToFollow",
    "ready_for_exclusive" BOOLEAN NOT NULL DEFAULT false,
    "trust_level" INTEGER NOT NULL DEFAULT 3,
    "manager_comment" TEXT,
    "funnel_stage" "SellerFunnelStage" NOT NULL DEFAULT 'CONTACT',
    "strategy_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "broker_id" TEXT NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seller_id" TEXT NOT NULL,

    CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_properties" (
    "id" TEXT NOT NULL,
    "property_type" TEXT NOT NULL DEFAULT 'APARTMENT',
    "rooms" INTEGER NOT NULL,
    "residential_complex" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "area" DECIMAL(10,2) NOT NULL,
    "living_area" DECIMAL(10,2),
    "kitchen_area" DECIMAL(10,2),
    "floor" INTEGER NOT NULL,
    "total_floors" INTEGER NOT NULL,
    "year_built" INTEGER NOT NULL,
    "apartments_per_floor" INTEGER,
    "building_type" "BuildingType" NOT NULL DEFAULT 'PANEL',
    "ceiling_height" DECIMAL(3,2),
    "layout_type" "LayoutType" NOT NULL DEFAULT 'ISOLATED',
    "bathroom_type" TEXT,
    "balcony_type" TEXT,
    "location_quality" "LocationQuality" NOT NULL DEFAULT 'NORMAL',
    "view_type" "ViewType",
    "parking_type" "ParkingType" NOT NULL DEFAULT 'NONE',
    "parking_spaces" INTEGER NOT NULL DEFAULT 0,
    "repair_state" "RepairState" NOT NULL DEFAULT 'COSMETIC',
    "actual_condition" "ActualCondition" NOT NULL DEFAULT 'GOOD',
    "elevator_count" INTEGER NOT NULL DEFAULT 0,
    "has_freight_elevator" BOOLEAN NOT NULL DEFAULT false,
    "lobby_type" "LobbyType",
    "access_system" "AccessSystemType",
    "mop_state" "MopState",
    "has_closed_territory" BOOLEAN NOT NULL DEFAULT false,
    "last_capital_repair_year" INTEGER,
    "is_mortgaged" BOOLEAN NOT NULL DEFAULT false,
    "mortgage_bank" TEXT,
    "mortgage_remaining" DECIMAL(15,2),
    "mortgage_removal_method" TEXT,
    "encumbrance_type" "EncumbranceType" NOT NULL DEFAULT 'NONE',
    "encumbrance_description" TEXT,
    "documents_verified" BOOLEAN NOT NULL DEFAULT false,
    "has_floor_heating" BOOLEAN NOT NULL DEFAULT false,
    "has_walk_in_closet" BOOLEAN NOT NULL DEFAULT false,
    "has_air_conditioning" BOOLEAN NOT NULL DEFAULT false,
    "has_built_in_appliances" BOOLEAN NOT NULL DEFAULT false,
    "furniture_level" TEXT,
    "appliances_level" TEXT,
    "glazing_type" "GlazingType",
    "facade_material" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "price_per_sqm" DECIMAL(15,2),
    "market_price" DECIMAL(15,2),
    "calculated_class" "PropertyClass",
    "finance_type" "FinanceType" NOT NULL DEFAULT 'MORTGAGE_AVAILABLE',
    "liquidity_score" INTEGER NOT NULL DEFAULT 50,
    "liquidity_level" "LiquidityLevel",
    "is_illiquid" BOOLEAN NOT NULL DEFAULT false,
    "illiquid_reason" TEXT,
    "active_strategy" "StrategyType",
    "strategy_explanation" TEXT,
    "funnel_stage" "PropertyFunnelStage" NOT NULL DEFAULT 'CREATED',
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "shows_count" INTEGER NOT NULL DEFAULT 0,
    "leads_count" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "video_url" TEXT,
    "virtual_tour_url" TEXT,
    "layout_image" TEXT,
    "casa_url" TEXT,
    "krisha_url" TEXT,
    "kn_url" TEXT,
    "olx_url" TEXT,
    "instagram_url" TEXT,
    "notes" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "seller_id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,

    CONSTRAINT "crm_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_calculation_logs" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "previous_class" "PropertyClass",
    "new_class" "PropertyClass",
    "previous_liquidity" INTEGER,
    "new_liquidity" INTEGER,
    "previous_strategy" "StrategyType",
    "new_strategy" "StrategyType",
    "calculation_reason" TEXT NOT NULL,
    "input_data" JSONB NOT NULL,
    "output_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_calculation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_iin_key" ON "sellers"("iin");

-- CreateIndex
CREATE INDEX "sellers_broker_id_idx" ON "sellers"("broker_id");

-- CreateIndex
CREATE INDEX "sellers_funnel_stage_idx" ON "sellers"("funnel_stage");

-- CreateIndex
CREATE INDEX "sellers_phone_idx" ON "sellers"("phone");

-- CreateIndex
CREATE INDEX "seller_documents_seller_id_idx" ON "seller_documents"("seller_id");

-- CreateIndex
CREATE INDEX "crm_properties_seller_id_idx" ON "crm_properties"("seller_id");

-- CreateIndex
CREATE INDEX "crm_properties_broker_id_idx" ON "crm_properties"("broker_id");

-- CreateIndex
CREATE INDEX "crm_properties_funnel_stage_idx" ON "crm_properties"("funnel_stage");

-- CreateIndex
CREATE INDEX "crm_properties_calculated_class_idx" ON "crm_properties"("calculated_class");

-- CreateIndex
CREATE INDEX "crm_properties_liquidity_level_idx" ON "crm_properties"("liquidity_level");

-- CreateIndex
CREATE INDEX "crm_properties_active_strategy_idx" ON "crm_properties"("active_strategy");

-- CreateIndex
CREATE INDEX "crm_properties_district_idx" ON "crm_properties"("district");

-- CreateIndex
CREATE INDEX "crm_properties_status_idx" ON "crm_properties"("status");

-- CreateIndex
CREATE INDEX "property_calculation_logs_property_id_idx" ON "property_calculation_logs"("property_id");

-- CreateIndex
CREATE INDEX "property_calculation_logs_created_at_idx" ON "property_calculation_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_properties" ADD CONSTRAINT "crm_properties_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_properties" ADD CONSTRAINT "crm_properties_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_calculation_logs" ADD CONSTRAINT "property_calculation_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
