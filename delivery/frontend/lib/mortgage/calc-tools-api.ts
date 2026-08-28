/**
 * Калькулятор брокера — клиент серверного расчёта.
 *
 * Здесь нет ипотечной математики и не может быть. Раньше платёж считался прямо
 * в браузере через Math.pow; теперь те же поля уходят на сервер, где работает
 * утверждённый движок M06 (CALC-F-001/002, decimal precision=50). Клиент только
 * показывает то, что вернул сервер.
 *
 * Это прикидка, а не артефакт кейса: ответ помечен `is_case_artifact: false`,
 * не содержит хэшей и не может использоваться как доказательство.
 */

import { API_URL } from "@/lib/api-client";
import { MortgageCaseApiError } from "./case-api";

export interface FormulaView {
  formula_id: string;
  machine_name: string;
  formula_version: string;
  raw: string | null;
  value: string | null;
  display_kzt: number | null;
  status: "COMPLETED" | "COMPLETED_WITH_LIMITATIONS" | "BLOCKED" | "INVALID_INPUT";
  codes: string[];
  currency: string;
}

export interface Quote {
  is_case_artifact: false;
  note: string;
  engine_version: string;
  decimal_context_version: string;
  formula_registry_version: string;
  required_financing: FormulaView;
  annuity_payment: FormulaView;
}

export interface ProgramQuote extends Quote {
  program: {
    id: string;
    bank_name: string;
    program_name: string;
    interest_rate: string;
    min_down_payment_percent: string;
    max_term_months: number;
    property_type: string;
  };
  term_months_used: number;
  term_capped_by_program: boolean;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Сервер недоступен — показываем ошибку, а НЕ считаем «примерно» сами.
    throw new MortgageCaseApiError("Расчёт временно недоступен", 0, "network_error");
  }
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = (parsed as { error?: { message?: string; code?: string } })?.error;
    throw new MortgageCaseApiError(
      typeof error?.message === "string" ? error.message : `Ошибка сервера (${response.status})`,
      response.status,
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  return (parsed as { data: T }).data;
}

export interface QuoteInput {
  target_price: string;
  available_now_down_payment?: string;
  annual_nominal_rate_percent: string;
  term_months: number;
}

export async function getQuote(input: QuoteInput): Promise<Quote> {
  return call<Quote>("/v2/calculation-tools/quote", input);
}

export async function getProgramQuotes(input: {
  target_price: string;
  available_now_down_payment?: string;
  term_months: number;
  property_type?: "NEW_BUILDING" | "SECONDARY";
}): Promise<{ disclaimer: string; quotes: ProgramQuote[] }> {
  return call("/v2/calculation-tools/program-quotes", input);
}
