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

/**
 * Агрегат взноса. Движок различает ТИП источника: залог деньгами не считается,
 * нераспознанный тип делает агрегат неполным. Причина неполноты приходит
 * отдельными счётчиками, чтобы экран не выдумывал объяснение.
 */
export interface AggregatedDownPayment extends AggregatedMoney {
  excludedNonMonetary: number;
  unknownEligibility: number;
}

/** Типы источников взноса, которые понимает движок (M05 §13). */
export const DOWN_PAYMENT_KINDS: { value: string; label: string; cash: boolean }[] = [
  { value: "CASH_SAVINGS", label: "Накопления наличными", cash: true },
  { value: "BANK_DEPOSIT", label: "Вклад в банке", cash: true },
  { value: "OTBASY_SAVINGS", label: "Накопления в Отбасы банке", cash: true },
  { value: "EPV_PENSION", label: "Пенсионные накопления", cash: true },
  { value: "HOUSING_CERTIFICATE", label: "Жилищный сертификат", cash: true },
  { value: "ASSET_SALE", label: "Продажа имущества", cash: true },
  { value: "GIFT", label: "Помощь родственников (дарение)", cash: true },
  { value: "ADDITIONAL_COLLATERAL", label: "Дополнительный залог — не деньги", cash: false },
  { value: "OTHER", label: "Другое — потребует уточнения", cash: false },
];

export const DOWN_PAYMENT_KIND_LABEL: Record<string, string> = Object.fromEntries(
  DOWN_PAYMENT_KINDS.map((k) => [k.value, k.label]),
);

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
    available_now_total: AggregatedDownPayment;
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

// --- CASA-скоринг доступности ------------------------------------------------

export type ScoringVerdict = "FITS" | "NOT_ENOUGH" | "NEEDS_DATA" | "INVALID_INPUT";

export interface ScoringMoney {
  raw: string | null;
  value: string | null;
  displayKzt: number | null;
}

export interface ScoringResult {
  version: string;
  verdict: ScoringVerdict;
  unverifiedInputs: boolean;
  requiredFinancing: CalcFormulaResult;
  monthlyPayment: CalcFormulaResult;
  paymentCapacity: ScoringMoney;
  maxLoan: ScoringMoney;
  paymentGap: ScoringMoney;
  loanGap: ScoringMoney;
  missing: { field: string; action: string }[];
  codes: string[];
  parameters: {
    annualNominalRatePercent: string | null;
    termMonths: number | null;
    paymentSharePercent: string;
  };
  disclaimer: string;
  sources: {
    target_price: "apartment" | "purchase_goal";
    monthly_credit_payments: "credit_report" | null;
    credit_report_id: string | null;
  };
}

/**
 * Скоринг «потянет ли клиент эту квартиру». Считает сервер: цена, взнос, доход
 * и обязательства берутся из профиля, платежи по кредитам — из отчёта ПКБ.
 */
export async function runScoring(
  caseId: string,
  input: {
    annual_nominal_rate_percent: string;
    term_months: number;
    payment_share_percent?: string;
    target_price?: string;
  },
): Promise<ScoringResult> {
  return call<ScoringResult>(`/v2/cases/${encodeURIComponent(caseId)}/scoring`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Доход клиента в месяц (M05 income_sources). */
export async function addIncomeSource(
  caseId: string,
  source: { kind: string; amount: string | null; status: ProfileFieldStatus },
): Promise<MoneySourceRow> {
  return call<MoneySourceRow>(
    `/v2/cases/${encodeURIComponent(caseId)}/income-sources`,
    { method: "POST", body: JSON.stringify(source) },
  );
}

/** Прочие ежемесячные обязательства (алименты, аренда) — не кредиты. */
export async function addCommitment(
  caseId: string,
  source: { kind: string; amount: string | null; status: ProfileFieldStatus },
): Promise<MoneySourceRow> {
  return call<MoneySourceRow>(
    `/v2/cases/${encodeURIComponent(caseId)}/non-credit-commitments`,
    { method: "POST", body: JSON.stringify(source) },
  );
}

/** Удаление строки анкеты: без него ошибочная запись блокирует расчёт навсегда. */
async function remove(path: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { method: "DELETE", credentials: "include" })
    .catch(() => { throw new MortgageCaseApiError("Сервер недоступен", 0, "network_error"); });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({}));
    const error = (body as { error?: { message?: string } })?.error;
    throw new MortgageCaseApiError(error?.message ?? `Ошибка сервера (${response.status})`, response.status);
  }
}

export function removeDownPaymentSource(caseId: string, rowId: string): Promise<void> {
  return remove(`/v2/cases/${encodeURIComponent(caseId)}/down-payment-sources/${encodeURIComponent(rowId)}`);
}
export function removeIncomeSource(caseId: string, rowId: string): Promise<void> {
  return remove(`/v2/cases/${encodeURIComponent(caseId)}/income-sources/${encodeURIComponent(rowId)}`);
}
export function removeCommitment(caseId: string, rowId: string): Promise<void> {
  return remove(`/v2/cases/${encodeURIComponent(caseId)}/non-credit-commitments/${encodeURIComponent(rowId)}`);
}

/**
 * Убрать расчёт из работы.
 *
 * Именно убрать, а не удалить: в базе аудит, ревизии документов и снимки
 * закрыты триггерами append-only, история расчёта неудаляема по регуляторному
 * требованию. Кейс уходит в архив и пропадает из рабочего списка.
 */
export function archiveMortgageCase(caseId: string): Promise<MortgageCase> {
  return call<MortgageCase>(`/v2/cases/${encodeURIComponent(caseId)}/archive`, { method: "POST" });
}

// --- Подбор квартир под бюджет ----------------------------------------------

export interface MatchedProperty {
  source: "NEW_BUILD" | "SECONDARY";
  id: string;
  title: string;
  location: string;
  price: string;
  rooms: number;
  area: string;
  floor: number | null;
  url: string;
}

export interface PropertyMatch {
  /** Максимальный кредит + взнос. null — бюджет не посчитан. */
  budget: string | null;
  max_loan?: string | null;
  down_payment?: string | null;
  verdict: ScoringVerdict;
  missing: { field: string; action: string }[];
  items: MatchedProperty[];
}

/**
 * Квартиры в пределах бюджета клиента. Это фильтр по цене, а не обещание
 * одобрения: бюджет считает тот же скоринг, что и вердикт.
 */
export async function getMatchingProperties(
  caseId: string,
  input: {
    annual_nominal_rate_percent: string;
    term_months: number;
    payment_share_percent?: string;
    rooms?: number;
  },
): Promise<PropertyMatch> {
  const q = new URLSearchParams({
    annual_nominal_rate_percent: input.annual_nominal_rate_percent,
    term_months: String(input.term_months),
  });
  if (input.payment_share_percent) q.set("payment_share_percent", input.payment_share_percent);
  if (input.rooms) q.set("rooms", String(input.rooms));
  return call<PropertyMatch>(`/v2/cases/${encodeURIComponent(caseId)}/matching-properties?${q}`);
}
