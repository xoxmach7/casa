/**
 * Клиент M02 R0 (API-M02-001…006).
 *
 * Фронт НИЧЕГО не интерпретирует: статусы, исходы, человеческие тексты и
 * покрытие приходят с сервера уже вычисленными. Здесь нет и не должно быть
 * логики «если manual, то считаем проверенным» — именно такая подмена на
 * клиенте и превращает частичную проверку в «чистого клиента».
 *
 * ИИН передаётся ТОЛЬКО в теле POST и никогда не попадает в путь или query.
 */

import { API_URL } from "@/lib/api-client";
import { MortgageCaseApiError } from "./case-api";

export type CheckStatus =
  | "QUEUED" | "RUNNING" | "COMPLETED" | "MANUAL_REQUIRED"
  | "BLOCKED" | "UNAVAILABLE" | "ERROR" | "NOT_ALLOWED";

export type CheckOutcome = "FOUND" | "NOT_FOUND" | "ZERO" | "NOT_APPLICABLE" | "UNKNOWN" | null;

export type OverallStatus =
  | "COMPLETE_FACTS_FOUND" | "COMPLETE_NO_RECORDS" | "PARTIAL"
  | "BLOCKED_CONSENT" | "BLOCKED_LEGAL" | "STALE";

export interface Coverage {
  requiredTotal: number;
  completed: number;
  provenNegative: number;
  found: number;
  manual: number;
  unavailable: number;
  blocked: number;
  stale: number;
  unknown: number;
  error: number;
  overallStatus: OverallStatus;
  brokerText: string;
}

export interface ManualTask {
  task_id: string;
  source_code: string;
  check_type: string;
  official_url: string;
  instruction: string;
  due_at: string | null;
  expires_at: string | null;
  status: "OPEN" | "IN_PROGRESS" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  outcome: CheckOutcome;
  evidence: { reference: string | null; hash: string | null; present: boolean };
  checked_at: string | null;
  confirmed_at: string | null;
}

export interface CheckResult {
  result_id: string;
  source: {
    code: string;
    owner: string;
    official_url: string;
    check_type: string;
    automation_mode: string;
    connector_enabled: boolean;
  };
  required: boolean;
  status: CheckStatus;
  outcome: CheckOutcome;
  error_category: string | null;
  retryable: boolean;
  reason: string;
  human_text: string;
  freshness: {
    checkedAt: string | null;
    sourceDataAsOf: string | null;
    freshUntil: string | null;
    stale: boolean;
    ageText: string;
    sourceDataAsOfText: string;
  };
  evidence: { reference: string | null; hash: string | null; present: boolean };
  facts: { key: string; value: unknown }[];
  manual_tasks: ManualTask[];
  disclaimer: string;
}

export interface CheckBatch {
  batch_id: string;
  case_id: string;
  participant: { party_id: string; iin_masked: string; identity_version: number };
  manifest: { manifest_version: string; registry_version: string; required_total: number };
  coverage: Coverage;
  overall_status: OverallStatus;
  blocker_code: string | null;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  created_at: string;
  results?: CheckResult[];
}

function idempotencyKey(prefix: string): string {
  return typeof crypto?.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function call<T>(path: string, init: RequestInit & { idempotency?: string } = {}): Promise<T> {
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
  return (body as { data: T }).data;
}

/** API-M02-001. ИИН уходит в теле — никогда в URL. */
export async function createCheckBatch(
  caseId: string,
  input: { party_id: string; iin: string; identity_version: number },
): Promise<CheckBatch> {
  return call<CheckBatch>(`/v2/cases/${encodeURIComponent(caseId)}/iin-check-batches`, {
    method: "POST",
    idempotency: "m02-batch",
    body: JSON.stringify(input),
  });
}

/** API-M02-003 — карточки источников. */
export async function getCheckResults(batchId: string): Promise<{
  batch_id: string; coverage: Coverage; overall_status: OverallStatus; results: CheckResult[];
}> {
  return call(`/v2/iin-check-batches/${encodeURIComponent(batchId)}/results`);
}

/** API-M02-005. Evidence обязателен — сервер откажет без него. */
export async function confirmManualTask(
  taskId: string,
  input: {
    outcome: Exclude<CheckOutcome, null>;
    evidence_ref: string;
    checked_at: string;
    source_data_as_of?: string | null;
    comment?: string;
  },
): Promise<{ task: ManualTask; coverage: Coverage }> {
  return call(`/v2/manual-check-tasks/${encodeURIComponent(taskId)}/confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** API-M02-006 — новый batch, прошлый остаётся в истории. */
export async function refreshCheckBatch(batchId: string): Promise<CheckBatch> {
  return call<CheckBatch>(`/v2/iin-check-batches/${encodeURIComponent(batchId)}/refresh`, {
    method: "POST",
    idempotency: "m02-refresh",
    body: JSON.stringify({}),
  });
}
