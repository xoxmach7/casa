import { API_URL } from "@/lib/api-client";

export interface MortgageCase {
  id: string;
  client_id: string;
  owner_id?: string;
  status: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export class MortgageCaseApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "MortgageCaseApiError";
  }
}

function idempotencyKey(): string {
  return typeof crypto?.randomUUID === "function"
    ? `mortgage-case-${crypto.randomUUID()}`
    : `mortgage-case-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createMortgageCase(clientId: string): Promise<MortgageCase> {
  const response = await fetch(`${API_URL}/v1/mortgage-cases`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey(),
    },
    body: JSON.stringify({ client_id: clientId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body?.error;
    throw new MortgageCaseApiError(
      typeof error?.message === "string" ? error.message : `Ошибка сервера (${response.status})`,
      response.status,
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  return body.data as MortgageCase;
}