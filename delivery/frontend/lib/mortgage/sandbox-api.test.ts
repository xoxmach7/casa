import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MortgageSandboxApiError,
  checkMortgageSandboxIin,
  getMortgageSandboxStatus,
  uploadMortgageSandboxDocument,
} from "./sandbox-api";

describe("mortgage sandbox API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the authenticated sandbox status with cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "synthetic",
        productionSafe: true,
        officialIinCheck: false,
        externalSourceStatus: "EXTERNAL_SOURCE_NOT_CONNECTED",
        policyVersion: "2026-08-24",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMortgageSandboxStatus()).resolves.toMatchObject({ mode: "synthetic" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/mortgage-workspace/sandbox/status"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("requires the synthetic attestation on document upload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "document-id", stored: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const formSpy = vi.spyOn(FormData.prototype, "append");

    await uploadMortgageSandboxDocument({
      type: "credit_history",
      file: new File(["%PDF- synthetic"], "synthetic.pdf", { type: "application/pdf" }),
      syntheticAttestation: true,
    });

    expect(formSpy).toHaveBeenCalledWith("syntheticAttestation", "true");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/mortgage-workspace/documents"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("preserves a server rejection instead of converting it into a local success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ code: "REAL_IIN_DETECTED", error: "Document rejected" }),
    }));

    await expect(getMortgageSandboxStatus()).rejects.toMatchObject({
      status: 422,
      code: "REAL_IIN_DETECTED",
      message: "Document rejected",
    });
  });

  it("keeps checksum validity separate from unavailable official sources", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shapeValid: true,
        checksumValid: true,
        externalSourceStatus: "EXTERNAL_SOURCE_NOT_CONNECTED",
        officialResult: null,
      }),
    }));

    await expect(checkMortgageSandboxIin("900101300123")).resolves.toMatchObject({
      checksumValid: true,
      externalSourceStatus: "EXTERNAL_SOURCE_NOT_CONNECTED",
      officialResult: null,
    });
  });
});