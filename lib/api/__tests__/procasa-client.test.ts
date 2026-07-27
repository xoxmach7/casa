import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getValuation, getProperties, getProperty, submitViewingRequest, submitPropertyLead, submitLeadForm } from "../procasa-client";

const originalFetch = global.fetch;

describe("procasa-client", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getValuation posts to /api/public/valuation and returns parsed JSON on success", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ marketValue: 36_000_000, urgentPrice: 32_400_000, marketPrice: 33_480_000, comparablesCount: 2 }),
    });

    const result = await getValuation({ district: "Бостандыкский", rooms: 2, area: 60 });

    expect(result).toEqual({ status: "ready", marketValue: 36_000_000, urgentPrice: 32_400_000, marketPrice: 33_480_000, comparablesCount: 2 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/valuation"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getValuation returns insufficient_data on a 422", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "no data" }) });

    const result = await getValuation({ district: "Турксибский", rooms: 4, area: 120 });

    expect(result).toEqual({ status: "insufficient_data" });
  });

  it("getProperties fetches the catalog list", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ properties: [{ id: "p1" }] }) });

    const result = await getProperties();

    expect(result).toEqual([{ id: "p1" }]);
  });

  it("getProperty fetches a single property or null on 404", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const result = await getProperty("missing");

    expect(result).toBeNull();
  });

  it("submitViewingRequest posts and returns true on success", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const result = await submitViewingRequest({ propertyId: "p1", name: "Аружан", phone: "+7700" });

    expect(result).toBe(true);
  });

  it("submitPropertyLead posts and returns sellerId on success", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, sellerId: "s1" }) });

    const result = await submitPropertyLead({
      district: "Бостандыкский",
      residentialComplex: "Comfort City",
      address: "ул. Розыбакиева",
      houseNumber: "100",
      price: 36_000_000,
      negotiable: true,
      moveInReady: false,
      furnished: false,
      hasAppliances: false,
      rooms: 2,
      area: 60,
      contactName: "Аружан",
      contactPhone: "+7700",
    });

    expect(result).toEqual({ success: true, sellerId: "s1" });
  });

  it("submitLeadForm posts form data to the given formId", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, sellerId: "s1" }) });

    const result = await submitLeadForm("form_1", { name: "Аружан", phone: "+7700", expectedPrice: "36000000" });

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/forms/form_1/submit"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
