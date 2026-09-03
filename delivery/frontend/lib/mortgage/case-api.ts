/**
 * Клиент канонического ипотечного API (/api/v2/cases, M01→M06).
 *
 * Здесь НЕТ и не может быть ипотечной математики. M06 Production Spec v1.4 §29
 * и §18 делают единственным numeric authority бэкендовый детерминированный
 * движок (decimal precision=50, ROUND_HALF_EVEN). Фронт передаёт входы и
 * ОТОБРАЖАЕТ то, что вернул сервер: raw / persisted / display / status /
 * formula_version. Если сервер недоступен — показывается ошибка, а НЕ
 * посчитанное на клиенте «примерное» число.
 */

import { API_URL } from "@/lib/api-client";

/** Строка списка кейсов (DEC-API-002): только то, что нужно для выбора. */
export interface MortgageCaseListItem {
  id: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  /** ФИО клиента — чтобы брокер понимал, чей это расчёт, а не видел id. */
  client_name?: string | null;
}

export interface MortgageCaseParty {
  id: string;
  clientId: string;
  role: string;
  includedInAnalysis: boolean;
}

export interface MortgageCase {
  id: string;
  client_id: string;
  owner_id?: string;
  status: string;
  version: number;
  created_at?: string;
  updated_at?: string;
  parties?: MortgageCaseParty[];
  /** ФИО клиента — отдаётся владельцу кейса, чтобы шапка не была набором id. */
  client_name?: string | null;
}

export type ProfileFieldStatus = "DECLARED" | "VERIFIED" | "UNKNOWN" | "CONFLICT";

export interface PurchaseGoal {
  target_price_max: string | null;
  currency: string;
  status: ProfileFieldStatus | string;
}

export interface AggregatedMoney {
  value: string | null;
  status: "CONFIRMED" | "DECLARED" | "UNKNOWN";
  complete: boolean;
  currency: string;
  counted: number;
  total: number;
}

export interface MoneySourceRow {
  id: string;
  kind: string;
  amount: string | null;
  currency: string;
  status: ProfileFieldStatus;
}

export interface ClientProfile {
  id: string;
  case_id: string;
  version: number;
  purchase_goal: PurchaseGoal;
  latest_snapshot: { id: string; content_hash: string; created_at: string } | null;
  down_payment_sources: MoneySourceRow[];
  income_sources: MoneySourceRow[];
  assets: MoneySourceRow[];
  employments: unknown[];
  non_credit_commitments: MoneySourceRow[];
  aggregates: {
    available_now_total: AggregatedMoney;
    monthly_income_total: AggregatedMoney;
    monthly_commitments_total: AggregatedMoney;
  };
}

export interface ProfileSnapshot {
  id: string;
  case_id: string;
  version: number;
  content_hash: string;
  created_at: string;
}

export type CalcStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_LIMITATIONS"
  | "BLOCKED"
  | "INVALID_INPUT";

/** Результат одной формулы — ровно в том виде, как его вернул движок M06. */
export interface CalcFormulaResult {
  formulaId: string;
  machineName: string;
  formulaVersion: string;
  raw: string | null;
  value: string | null;
  displayKzt: number | null;
  status: CalcStatus;
  codes: string[];
  currency: string;
}

export interface CalculationBlocker {
  code: string;
  reason: string;
  blocking_input_refs: string[];
  formula_id: string;
}

export interface CalculationSnapshot {
  id: string;
  run_id: string;
  case_id: string;
  schema_version: string;
  engine_version: string;
  decimal_context_version: string;
  formula_registry_version: string;
  canonicalization_version: string;
  client_profile_snapshot: { snapshot_id: string; snapshot_hash: string };
  input_hash: string;
  output_hash: string;
  replay_hash: string;
  status: CalcStatus;
  results: {
    requiredFinancing: CalcFormulaResult;
    annuity: CalcFormulaResult;
    status: CalcStatus;
    codes: string[];
    blockers: CalculationBlocker[];
  };
  created_at: string;
}

export class MortgageCaseApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "MortgageCaseApiError";
  }
}

function idempotencyKey(prefix: string): string {
  return typeof crypto?.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function callRaw<T, P = undefined>(
  path: string,
  init: RequestInit & { idempotency?: string } = {},
): Promise<{ data: T; page_info?: P }> {
  const { idempotency, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...rest,
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(idempotency ? { "Idempotency-Key": idempotencyKey(idempotency) } : {}),
        ...(rest.headers ?? {}),
      },
    });
  } catch {
    // Сеть недоступна. Наверх уходит ошибка — не «примерный» расчёт.
    throw new MortgageCaseApiError("Сервер недоступен", 0, "network_error");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = (body as { error?: { message?: string; code?: string } })?.error;
    throw new MortgageCaseApiError(
      typeof error?.message === "string" ? error.message : `Ошибка сервера (${response.status})`,
      response.status,
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  return body as { data: T; page_info?: P };
}

async function call<T>(
  path: string,
  init: RequestInit & { idempotency?: string } = {},
): Promise<T> {
  return (await callRaw<T>(path, init)).data;
}

// --- M01 -------------------------------------------------------------------

export async function createMortgageCase(clientId: string): Promise<MortgageCase> {
  // DEC-API-001 (FROZEN): canonical case namespace = /api/v2/cases.
  return call<MortgageCase>("/v2/cases", {
    method: "POST",
    body: JSON.stringify({ client_id: clientId }),
    idempotency: "mortgage-case",
  });
}

/**
 * DEC-API-002 — вспомогательный листинг кейсов. Не входит в 45 канонических
 * контрактов. Отдаёт минимальный allowlist полей: ни client_id, ни owner_id,
 * потому что для выбора кейса они не нужны, а в списке это лишние ПД.
 */
export async function listMortgageCases(
  params: { limit?: number; cursor?: string } = {},
): Promise<{ items: MortgageCaseListItem[]; nextCursor: string | null; hasMore: boolean }> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  const suffix = query.toString() ? `?${query}` : "";

  const raw = await callRaw<
    MortgageCaseListItem[],
    { has_more: boolean; next_cursor: string | null; limit: number }
  >(`/v2/cases${suffix}`);
  return {
    items: raw.data,
    nextCursor: raw.page_info?.next_cursor ?? null,
    hasMore: raw.page_info?.has_more ?? false,
  };
}

export async function getMortgageCase(caseId: string): Promise<MortgageCase> {
  return call<MortgageCase>(`/v2/cases/${encodeURIComponent(caseId)}`);
}

// --- M05 -------------------------------------------------------------------

export async function getClientProfile(caseId: string): Promise<ClientProfile> {
  return call<ClientProfile>(`/v2/cases/${encodeURIComponent(caseId)}/client-profile`);
}

export async function setPurchaseGoal(
  caseId: string,
  goal: { target_price_max: string | null; status: ProfileFieldStatus },
): Promise<{ purchase_goal: PurchaseGoal }> {
  return call<{ purchase_goal: PurchaseGoal }>(
    `/v2/cases/${encodeURIComponent(caseId)}/client-profile`,
    { method: "PATCH", body: JSON.stringify({ purchase_goal: goal }) },
  );
}

export async function addDownPaymentSource(
  caseId: string,
  source: { kind: string; amount: string | null; status: ProfileFieldStatus },
): Promise<MoneySourceRow> {
  return call<MoneySourceRow>(
    `/v2/cases/${encodeURIComponent(caseId)}/down-payment-sources`,
    { method: "POST", body: JSON.stringify(source) },
  );
}

export async function publishProfileSnapshot(caseId: string): Promise<ProfileSnapshot> {
  return call<ProfileSnapshot>(
    `/v2/cases/${encodeURIComponent(caseId)}/client-profile/publish-snapshot`,
    { method: "POST" },
  );
}

// --- M06 -------------------------------------------------------------------

/**
 * Запускает детерминированный прогон M06. Деньги в запрос НЕ передаются: их
 * источник — опубликованный снапшот профиля (§21). Клиент передаёт только
 * ссылку на снапшот и явные параметры (ставка/срок).
 */
export async function createCalculationRun(
  caseId: string,
  input: {
    client_profile_snapshot_id: string;
    annual_nominal_rate_percent: string;
    term_months: number;
  },
): Promise<CalculationSnapshot> {
  return call<CalculationSnapshot>(
    `/v2/cases/${encodeURIComponent(caseId)}/calculation-runs`,
    {
      method: "POST",
      idempotency: "mortgage-calc",
      body: JSON.stringify({
        client_profile_snapshot_id: input.client_profile_snapshot_id,
        parameters: {
          annual_nominal_rate_percent: input.annual_nominal_rate_percent,
          term_months: input.term_months,
          payment_frequency: "MONTHLY",
        },
      }),
    },
  );
}
