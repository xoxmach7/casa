import { API_URL } from "@/lib/api-client";

export type MortgageSandboxDocumentType = "credit_history" | "enpf_statement";

export interface MortgageSandboxStatus {
  mode: "synthetic";
  productionSafe: boolean;
  officialIinCheck: boolean;
  externalSourceStatus: "EXTERNAL_SOURCE_NOT_CONNECTED";
  policyVersion: string;
}

export interface MortgageSandboxIinCheck {
  shapeValid: boolean;
  checksumValid: boolean;
  externalSourceStatus: "EXTERNAL_SOURCE_NOT_CONNECTED";
  officialResult: null;
}

export interface MortgageSandboxDocument {
  id: string;
  type: MortgageSandboxDocumentType;
  fileName: string;
  size: number;
  sha256: string;
  status: "needs_review" | "confirmed" | "processing_failed";
  storedAt: string;
  stored: true;
  sandbox: true;
  policyVersion: string;
  extraction: {
    fields?: Array<{
      key: string;
      label: string;
      rawValue?: unknown;
      normalizedValue?: unknown;
      presence: string;
      confidence: number;
      critical?: boolean;
    }>;
    gates?: string[];
    notes?: string[];
    statuses?: { file_integrity?: string; authenticity?: string; extraction?: string };
  };
}

export interface MortgageSandboxAnalysisResponse {
  sandbox: true;
  analysis: unknown;
}

export interface MortgageSandboxScenarioResponse {
  sandbox: true;
  scenario: unknown;
}

export class MortgageSandboxApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "MortgageSandboxApiError";
  }
}

const workspaceUrl = (path: string) => `${API_URL}/mortgage-workspace${path}`;

async function parseError(response: Response): Promise<MortgageSandboxApiError> {
  let body: { error?: unknown; code?: unknown } | undefined;
  try {
    body = await response.json();
  } catch {
    // A non-JSON gateway response is still a real failure, never local success.
  }
  const message = typeof body?.error === "string" ? body.error : `Ошибка сервера (${response.status})`;
  const code = typeof body?.code === "string" ? body.code : undefined;
  return new MortgageSandboxApiError(message, response.status, code);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(workspaceUrl(path), {
    credentials: "include",
    ...init,
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export function getMortgageSandboxStatus(): Promise<MortgageSandboxStatus> {
  return request("/sandbox/status");
}

export function checkMortgageSandboxIin(iin: string): Promise<MortgageSandboxIinCheck> {
  return request("/sandbox/iin-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iin }),
  });
}

export function uploadMortgageSandboxDocument(input: {
  type: MortgageSandboxDocumentType;
  file: File;
  syntheticAttestation: true;
}): Promise<MortgageSandboxDocument> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("type", input.type);
  form.append("syntheticAttestation", "true");
  return request("/documents", { method: "POST", body: form });
}

export function confirmMortgageSandboxDocument(id: string): Promise<{ id: string; status: "confirmed" }> {
  return request(`/documents/${encodeURIComponent(id)}/confirm`, { method: "PATCH" });
}

export function getMortgageSandboxAnalysis(): Promise<MortgageSandboxAnalysisResponse> {
  return request("/sandbox/analysis");
}

export function previewMortgageSandboxScenario(changes: unknown[]): Promise<MortgageSandboxScenarioResponse> {
  return request("/sandbox/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  });
}