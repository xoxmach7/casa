import { describe, it, expect } from "vitest";
import { matchAddress } from "../addresses";

describe("matchAddress", () => {
  it("matches a known address regardless of comma and case formatting", () => {
    const result = matchAddress("жошы хана, 27");
    expect(result).toEqual({
      status: "matched",
      residentialComplex: "Prime Garden",
      district: "Есиль",
      address: "жошы хана, 27",
      buildingClass: "comfort_plus",
    });
  });

  it("returns not_found for an address with no match", () => {
    expect(matchAddress("несуществующая улица 1")).toEqual({
      status: "not_found",
    });
  });
});
