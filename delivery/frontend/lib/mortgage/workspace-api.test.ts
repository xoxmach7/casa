import { describe, expect, it, vi } from "vitest";
import { calculateMortgage } from "./workspace-api";

describe("calculateMortgage", () => {
  it("uses the server calculator with the authenticated session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ monthlyPayment: 123 }), { status: 200 }));
    await calculateMortgage({ propertyPrice: 20_000_000, downPayment: 4_000_000, termMonths: 120, rate: 15, existingDebtPayment: 0, additionalConfirmedIncome: 0, baseIncome: 500_000 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/mortgage-workspace/whatif"), expect.objectContaining({ method: "POST", credentials: "include" }));
    fetchMock.mockRestore();
  });
});
