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
  getMortgageCase: vi.fn(),
  getClientProfile: vi.fn(),
  setPurchaseGoal: vi.fn(),
  addDownPaymentSource: vi.fn(),
  publishProfileSnapshot: vi.fn(),
  createCalculationRun: vi.fn(),
  createMortgageCase: vi.fn(),
  runScoring: vi.fn(),
  addIncomeSource: vi.fn(),
  addCommitment: vi.fn(),
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
  api.listMortgageCases.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  api.getClientProfile.mockResolvedValue(PROFILE);
  api.getMortgageCase.mockResolvedValue({
    id: "case_real_1", client_id: "cl_1", status: "DRAFT", version: 3,
    client_name: "Сериков Асхат", parties: [],
  });
  api.publishProfileSnapshot.mockResolvedValue({ id: "cps_1", content_hash: "f".repeat(64) });
});

afterEach(() => { vi.clearAllMocks(); });

describe("без выбранного кейса", () => {
  it("показывает нейтральное состояние и ни одной финансовой цифры", async () => {
    api.listMortgageCases.mockResolvedValue({
      items: [{
        id: "case_real_1", status: "DRAFT", version: 1,
        created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-20T00:00:00Z",
      }],
      nextCursor: null,
      hasMore: false,
    });
    render(<MortgagePage />);

    expect(
      await screen.findByText("Расчёты по клиентам"),
    ).toBeInTheDocument();

    // Профиль не запрашивается и суммы не показываются.
    expect(api.getClientProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/₸/);
    expect(document.body.textContent).not.toMatch(/\d[\d\s]{5,}/);
  });

  it("не содержит демо-кейса и синтетических данных клиента", async () => {
    render(<MortgagePage />);
    await screen.findByText("Расчёты по клиентам");
    const text = document.body.textContent ?? "";
    for (const mock of ["case-demo", "Айдос", "демонстрац", "Демо", "DEMO"]) {
      expect(text).not.toContain(mock);
    }
  });

  it("даёт брокеру способ начать проверку, а не только ссылку на список", async () => {
    render(<MortgagePage />);
    await screen.findByText("Расчёты по клиентам");
    // Экран обещает «начните новый», значит кнопка обязана существовать.
    expect(screen.getAllByRole("button", { name: /Новый расчёт/ }).length).toBeGreaterThan(0);
  });

  it("по кнопке открывает выбор клиента", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clients: [{ id: "cl_1", firstName: "Асхат", lastName: "Сериков", city: "Астана" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MortgagePage />);
    await screen.findByText("Расчёты по клиентам");
    await userEvent.click(screen.getAllByRole("button", { name: /Новый расчёт/ })[0]);

    expect(await screen.findByText("Сериков Асхат")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("с выбранным реальным кейсом", () => {
  beforeEach(() => { searchParams = new URLSearchParams("case=case_real_1"); });

  it("берёт цель и взнос из реального профиля M05", async () => {
    render(<MortgagePage />);
    await waitFor(() => expect(api.getClientProfile).toHaveBeenCalledWith("case_real_1"));
    // Шапка называет клиента по имени, а не идентификатором кейса.
    expect(await screen.findByText("Сериков Асхат")).toBeInTheDocument();
    // Сумма встречается и в агрегате, и в строке источника — обе из профиля.
    expect(screen.getAllByText("5 000 000,00 ₸").length).toBeGreaterThan(0);
  });

  it("не выносит идентификатор кейса в рабочее поле зрения брокера", async () => {
    render(<MortgagePage />);
    await screen.findByText("Сериков Асхат");
    // Идентификатор сохранён для поддержки, но спрятан в <details>.
    expect(screen.queryByText(/^Кейс case_real_1/)).toBeNull();
    expect(screen.getByText(/Служебные данные/)).toBeInTheDocument();
  });

  it("до прогона не показывает ни суммы кредита, ни платежа", async () => {
    render(<MortgagePage />);
    expect(await screen.findByText(/Нажмите «Рассчитать»/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Нужен кредит/);
  });

  it("показывает вердикт и суммы ровно так, как их вернул сервер", async () => {
    api.runScoring.mockResolvedValue({
      version: "casa-scoring/1.0.0",
      verdict: "FITS",
      unverifiedInputs: false,
      requiredFinancing: { formulaId: "CALC-F-001", machineName: "casa.required_financing", formulaVersion: "1.0.0", raw: "21000000", value: "21000000.00", displayKzt: 21000000, status: "COMPLETED", codes: [], currency: "KZT" },
      monthlyPayment: { formulaId: "CALC-F-002", machineName: "casa.annuity_payment_by_parameters", formulaVersion: "1.0.0", raw: "238589.51", value: "238589.51", displayKzt: 238590, status: "COMPLETED", codes: [], currency: "KZT" },
      paymentCapacity: { raw: "388288.98", value: "388288.98", displayKzt: 388289 },
      maxLoan: { raw: "34000000", value: "34000000.00", displayKzt: 34000000 },
      paymentGap: { raw: "0", value: "0.00", displayKzt: 0 },
      loanGap: { raw: "0", value: "0.00", displayKzt: 0 },
      missing: [],
      codes: ["WITHIN_CAPACITY"],
      parameters: { annualNominalRatePercent: "12.5", termMonths: 240, paymentSharePercent: "50" },
      disclaimer: "Предварительная оценка CASA по данным брокера.",
      sources: { target_price: "purchase_goal", monthly_credit_payments: "credit_report", credit_report_id: "d1" },
    });

    render(<MortgagePage />);
    await screen.findByText(/Нажмите «Рассчитать»/);
    await userEvent.click(screen.getByRole("button", { name: /^Рассчитать$/ }));

    expect(await screen.findByText("Клиент проходит по платежу")).toBeInTheDocument();
    expect(screen.getByText("21 000 000,00 ₸")).toBeInTheDocument();
    expect(screen.getByText("238 589,51 ₸")).toBeInTheDocument();
  });

  it("не хватает данных → говорит ЧТО сделать, а не выдаёт число", async () => {
    const blocked = { formulaId: "CALC-F-001", machineName: "m", formulaVersion: "1.0.0", raw: null, value: null, displayKzt: null, status: "BLOCKED", codes: [], currency: "KZT" };
    const empty = { raw: null, value: null, displayKzt: null };
    api.runScoring.mockResolvedValue({
      version: "casa-scoring/1.0.0",
      verdict: "NEEDS_DATA",
      unverifiedInputs: false,
      requiredFinancing: blocked,
      monthlyPayment: blocked,
      paymentCapacity: empty, maxLoan: empty, paymentGap: empty, loanGap: empty,
      missing: [{ field: "monthly_income", action: "Добавьте доход клиента в месяц" }],
      codes: ["INCOMPLETE_INPUTS"],
      parameters: { annualNominalRatePercent: "12.5", termMonths: 240, paymentSharePercent: "50" },
      disclaimer: "Предварительная оценка CASA по данным брокера.",
      sources: { target_price: "purchase_goal", monthly_credit_payments: null, credit_report_id: null },
    });

    render(<MortgagePage />);
    await screen.findByText(/Нажмите «Рассчитать»/);
    await userEvent.click(screen.getByRole("button", { name: /^Рассчитать$/ }));

    expect(await screen.findByText("Не хватает данных")).toBeInTheDocument();
    expect(screen.getByText("Добавьте доход клиента в месяц")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Нужен кредит/);
  });

  it("сервер недоступен → сообщение, а НЕ посчитанное на клиенте число", async () => {
    api.runScoring.mockRejectedValue(new MortgageCaseApiError("Сервер недоступен", 0, "network_error"));

    render(<MortgagePage />);
    await screen.findByText(/Нажмите «Рассчитать»/);
    await userEvent.click(screen.getByRole("button", { name: /^Рассчитать$/ }));

    expect(await screen.findByText("Скоринг временно недоступен")).toBeInTheDocument();
    expect(screen.queryByText(/^21 000 000/)).toBeNull();
  });

  it("не показывает запрещённые для релиза выходы", async () => {
    render(<MortgagePage />);
    await screen.findByText("Сериков Асхат");
    // Блок-заглушка с перечислением запрещённого удалён, поэтому проверяем
    // весь экран целиком — отрицать самому себе больше нечем.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/КДН/);
    expect(text).not.toMatch(/принимаемый доход/i);
    expect(text).not.toMatch(/вердикт/i);
    expect(text).not.toMatch(/вероятность одобрени/i);
    expect(text).not.toMatch(/программ[аыу]/i);
  });
});
