/**
 * Экран /dashboard/mortgage — требования релиза 1.0.
 *
 * Тест проверяет не «страница отрисовалась», а три запрета, из-за которых
 * предыдущая версия экрана была отозвана:
 *   1) без выбранного реального кейса нет ни одной финансовой цифры;
 *   2) на экране нет демо-кейса и синтетических сумм;
 *   3) при недоступном бэкенде расчёта не появляется посчитанное на клиенте число.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

const api = vi.hoisted(() => ({
  listMortgageCases: vi.fn(),
  getClientProfile: vi.fn(),
  setPurchaseGoal: vi.fn(),
  addDownPaymentSource: vi.fn(),
  publishProfileSnapshot: vi.fn(),
  createCalculationRun: vi.fn(),
}));

vi.mock("@/lib/mortgage/case-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mortgage/case-api")>(
    "@/lib/mortgage/case-api",
  );
  return { ...actual, ...api };
});

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import MortgagePage from "./page";
import { MortgageCaseApiError } from "@/lib/mortgage/case-api";

const PROFILE = {
  id: "prof_1",
  case_id: "case_real_1",
  version: 3,
  purchase_goal: { target_price_max: "30000000.00", currency: "KZT", status: "DECLARED" },
  latest_snapshot: null,
  down_payment_sources: [
    { id: "dp_1", kind: "Накопления", amount: "5000000.00", currency: "KZT", status: "DECLARED" as const },
  ],
  income_sources: [],
  assets: [],
  employments: [],
  non_credit_commitments: [],
  aggregates: {
    available_now_total: { value: "5000000.00", status: "DECLARED" as const, complete: true, currency: "KZT", counted: 1, total: 1 },
    monthly_income_total: { value: null, status: "UNKNOWN" as const, complete: false, currency: "KZT", counted: 0, total: 0 },
    monthly_commitments_total: { value: null, status: "UNKNOWN" as const, complete: false, currency: "KZT", counted: 0, total: 0 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  api.listMortgageCases.mockResolvedValue([]);
  api.getClientProfile.mockResolvedValue(PROFILE);
  api.publishProfileSnapshot.mockResolvedValue({ id: "cps_1", content_hash: "f".repeat(64) });
});

afterEach(() => { vi.clearAllMocks(); });

describe("без выбранного кейса", () => {
  it("показывает нейтральное состояние и ни одной финансовой цифры", async () => {
    api.listMortgageCases.mockResolvedValue([
      { id: "case_real_1", client_id: "client_7", status: "DRAFT", version: 1 },
    ]);
    render(<MortgagePage />);

    expect(
      await screen.findByText("Выберите или создайте ипотечный кейс"),
    ).toBeInTheDocument();

    // Профиль не запрашивается и суммы не показываются.
    expect(api.getClientProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/₸/);
    expect(document.body.textContent).not.toMatch(/\d[\d\s]{5,}/);
  });

  it("не содержит демо-кейса и синтетических данных клиента", async () => {
    render(<MortgagePage />);
    await screen.findByText("Выберите или создайте ипотечный кейс");
    const text = document.body.textContent ?? "";
    for (const mock of ["case-demo", "Айдос", "демонстрац", "Демо", "DEMO"]) {
      expect(text).not.toContain(mock);
    }
  });
});

describe("с выбранным реальным кейсом", () => {
  beforeEach(() => { searchParams = new URLSearchParams("case=case_real_1"); });

  it("берёт цель и взнос из реального профиля M05", async () => {
    render(<MortgagePage />);
    await waitFor(() => expect(api.getClientProfile).toHaveBeenCalledWith("case_real_1"));
    expect(await screen.findByText(/Кейс case_real_1/)).toBeInTheDocument();
    // Сумма встречается и в агрегате, и в строке источника — обе из профиля.
    expect(screen.getAllByText("5 000 000,00 ₸").length).toBeGreaterThan(0);
  });

  it("до прогона не показывает ни требуемого финансирования, ни платежа", async () => {
    render(<MortgagePage />);
    expect(
      await screen.findByText(/Расчёт ещё не выполнялся/),
    ).toBeInTheDocument();
  });

  it("показывает значения ровно так, как их вернул движок M06", async () => {
    api.createCalculationRun.mockResolvedValue({
      id: "snap_1", run_id: "run_1", case_id: "case_real_1",
      schema_version: "casa.calculation_snapshot/1.0.0",
      engine_version: "casa-calc-engine/1.0.0",
      decimal_context_version: "casa.decimal_context/p50-half-even__money-half-up/1.0.0",
      formula_registry_version: "m06-registry/1.0.0",
      canonicalization_version: "CASA-CJ-1",
      client_profile_snapshot: { snapshot_id: "cps_1", snapshot_hash: "f".repeat(64) },
      input_hash: "a".repeat(64), output_hash: "b".repeat(64), replay_hash: "c".repeat(64),
      status: "COMPLETED",
      results: {
        requiredFinancing: {
          formulaId: "CALC-F-001", machineName: "casa.required_financing", formulaVersion: "1.0.0",
          raw: "25000000", value: "25000000.00", displayKzt: 25000000,
          status: "COMPLETED", codes: [], currency: "KZT",
        },
        annuity: {
          formulaId: "CALC-F-002", machineName: "casa.annuity_payment_by_parameters", formulaVersion: "1.0.0",
          raw: "284035.13742859237380498879610315991992807755394768",
          value: "284035.14", displayKzt: 284035,
          status: "COMPLETED", codes: [], currency: "KZT",
        },
        status: "COMPLETED", codes: [], blockers: [],
      },
      created_at: "2026-08-27T00:00:00Z",
    });

    render(<MortgagePage />);
    await screen.findByText(/Расчёт ещё не выполнялся/);
    await userEvent.click(screen.getByRole("button", { name: /Рассчитать на сервере/ }));

    expect(await screen.findByText("284 035,14 ₸")).toBeInTheDocument();
    expect(screen.getByText("25 000 000,00 ₸")).toBeInTheDocument();
    // Расчёт всегда привязан к снапшоту профиля.
    expect(api.publishProfileSnapshot).toHaveBeenCalledWith("case_real_1");
    expect(api.createCalculationRun).toHaveBeenCalledWith("case_real_1", expect.objectContaining({
      client_profile_snapshot_id: "cps_1",
    }));
  });

  it("бэкенд расчёта недоступен → сообщение, а НЕ посчитанное на клиенте число", async () => {
    api.createCalculationRun.mockRejectedValue(new MortgageCaseApiError("Сервер недоступен", 0, "network_error"));

    render(<MortgagePage />);
    await screen.findByText(/Расчёт ещё не выполнялся/);
    await userEvent.click(screen.getByRole("button", { name: /Рассчитать на сервере/ }));

    expect(await screen.findByText("Расчёт временно недоступен")).toBeInTheDocument();
    // Ни требуемого финансирования, ни платежа — никакого fallback.
    expect(screen.queryByText(/^25 000 000/)).toBeNull();
    expect(screen.queryByText(/^284 035/)).toBeNull();
  });

  it("не показывает запрещённые для 1.0 выходы M06", async () => {
    render(<MortgagePage />);
    await screen.findByText(/Кейс case_real_1/);
    // Дисклеймер перечисляет запрещённое, чтобы сказать «не показывается»;
    // проверяем ОСТАВШИЙСЯ экран, иначе тест ловил бы собственное отрицание.
    const note = screen.getByTestId("release-scope-note").textContent ?? "";
    const text = (document.body.textContent ?? "").replace(note, "");

    expect(note).toMatch(/не рассчитывается/);
    expect(text).not.toMatch(/КДН/);
    expect(text).not.toMatch(/принимаемый доход/i);
    expect(text).not.toMatch(/вердикт/i);
    expect(text).not.toMatch(/сценари/i);
    expect(text).not.toMatch(/вероятность одобрени/i);
    expect(text).not.toMatch(/программ[аыу]/i);
  });
});
