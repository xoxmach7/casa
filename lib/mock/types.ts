export type BuildingClass = "economy" | "comfort" | "comfort_plus" | "business";

export type AddressMatchResult =
  | {
      status: "matched";
      residentialComplex: string;
      district: string;
      address: string;
      buildingClass: BuildingClass;
    }
  | { status: "not_found" };

export type RepairCondition =
  | "fresh_repair"
  | "good_livable"
  | "cosmetic"
  | "needs_repair";

export interface ValuationParams {
  rooms: number;
  areaM2: number;
  floor: number;
  totalFloors: number;
  repairCondition: RepairCondition;
}

export type ValuationResult =
  | {
      status: "ready";
      instantPrice: number;
      marketPrice: number;
      basePricePerM2: number;
    }
  | { status: "insufficient_data" };
