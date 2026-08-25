import { afterEach, describe, expect, it, vi } from "vitest";
import { createMortgageCase } from "./case-api";

afterEach(() => vi.unstubAllGlobals());

describe("mortgage case API", () => {
  it("creates a persisted mortgage case with cookie authentication and idempotency", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "case_1", client_id: "client_1", status: "DRAFT", version: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMortgageCase("client_1")).resolves.toMatchObject({ id: "case_1", status: "DRAFT" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v2/cases"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
      }),
    );
  });
});