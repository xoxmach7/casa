import { describe, it, expect } from "vitest";
import { calculateValuation } from "../valuation";

describe("calculateValuation", () => {
  it("returns instant (x0.90) and market (x0.93) prices for a known complex and room count", () => {
    const result = calculateValuation("Prime Garden", {
      rooms: 2,
      areaM2: 61,
      floor: 7,
      totalFloors: 9,
      repairCondition: "fresh_repair",
    });

    expect(result).toEqual({
      status: "ready",
      basePricePerM2: 856957,
      instantPrice: Math.round(856957 * 61 * 0.9),
      marketPrice: Math.round(856957 * 61 * 0.93),
    });
  });

  it("returns insufficient_data when the complex has no price for that room count", () => {
    const result = calculateValuation("Хайвил Астана блок А", {
      rooms: 4,
      areaM2: 161.8,
      floor: 9,
      totalFloors: 10,
      repairCondition: "good_livable",
    });

    expect(result).toEqual({ status: "insufficient_data" });
  });

  it("returns insufficient_data for an unknown complex name", () => {
    const result = calculateValuation("Неизвестный ЖК", {
      rooms: 2,
      areaM2: 50,
      floor: 3,
      totalFloors: 9,
      repairCondition: "cosmetic",
    });

    expect(result).toEqual({ status: "insufficient_data" });
  });
});
