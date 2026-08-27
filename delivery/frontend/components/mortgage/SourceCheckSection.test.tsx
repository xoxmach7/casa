/**
 * M02 §15 — правила broker UI.
 *
 * Проверяются требования, а не вёрстка: покрытие показывается первым, состояние
 * читается текстом (не только цветом), «недоступно» не выглядит как «записей
 * нет», подтверждение без доказательства невозможно, а найденный факт не
 * превращается в отказ банка.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({
  createCheckBatch: vi.fn(),
  getCheckResults: vi.fn(),
  confirmManualTask: vi.fn(),
  refreshCheckBatch: vi.fn(),
}));

vi.mock("@/lib/mortgage/m02-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mortgage/m02-api")>("@/lib/mortgage/m02-api");
  return { ...actual, ...api };
});

import { SourceCheckSection } from "./SourceCheckSection";

function result(over: Partial<any> = {}): any {
  return {
    result_id: `r_${Math.random().toString(36).slice(2)}`,
    source: {
      code: "ENIS_EXECUTIVE_INSCRIPTION",
      owner: "ЕНИС (нотариат)",
      official_url: "https://enis.kz/",
      check_type: "executive_inscription",
      automation_mode: "MANUAL",
      connector_enabled: false,
    },
    required: true,
    status: "MANUAL_REQUIRED",
    outcome: null,
    error_category: "MANUAL_REQUIRED",
    retryable: false,
    reason: "Ручная задача не выполнена",
    human_text: "Нужна ручная проверка на официальном сайте.",
    freshness: {
      checkedAt: null, sourceDataAsOf: null, freshUntil: null, stale: false,
      ageText: "Дата проверки неизвестна",
      sourceDataAsOfText: "Источник не указал дату актуальности",
    },
    evidence: { reference: null, hash: null, present: false },
    facts: [],
    manual_tasks: [{
      task_id: "task_1",
      source_code: "ENIS_EXECUTIVE_INSCRIPTION",
      check_type: "executive_inscription",
      official_url: "https://enis.kz/",
      instruction: "Откройте официальный сервис и зафиксируйте исход.",
      due_at: null, expires_at: null, status: "OPEN", outcome: null,
      evidence: { reference: null, hash: null, present: false },
      checked_at: null, confirmed_at: null,
    }],
    disclaimer: "Факт источника — не решение банка.",
    ...over,
  };
}

const coverage = {
  requiredTotal: 7, completed: 0, provenNegative: 0, found: 0, manual: 6,
  unavailable: 1, blocked: 0, stale: 0, unknown: 0, error: 0,
  overallStatus: "PARTIAL" as const,
  brokerText: "Проверка частичная: 0 из 7. Нельзя делать вывод об отсутствии записей.",
};

beforeEach(() => {
  vi.clearAllMocks();
  api.createCheckBatch.mockResolvedValue({
    batch_id: "batch_1",
    case_id: "case_1",
    participant: { party_id: "party_1", iin_masked: "••••••••••57", identity_version: 1 },
    manifest: { manifest_version: "casa.m02.manifest/1.0.0", registry_version: "casa.m02.source-registry/1.0.0", required_total: 7 },
    coverage,
    overall_status: "PARTIAL",
    blocker_code: null, supersedes_id: null, superseded_by_id: null,
    created_at: "2026-08-27T00:00:00Z",
  });
  api.getCheckResults.mockResolvedValue({
    batch_id: "batch_1", coverage, overall_status: "PARTIAL",
    results: [
      result(),
      result({
        source: { code: "KGD_TAXPAYER_IP_STATUS", owner: "КГД МФ РК", official_url: "https://kgd.gov.kz/", check_type: "taxpayer_ip_status", automation_mode: "UNAVAILABLE", connector_enabled: false },
        status: "UNAVAILABLE", outcome: null, error_category: "ACCESS_REQUIRED",
        human_text: "Автоматическая проверка пока не подключена.",
        manual_tasks: [],
      }),
    ],
  });
});

async function startCheck() {
  render(<SourceCheckSection caseId="case_1" partyId="party_1" />);
  await userEvent.type(screen.getByRole("textbox"), "900101300057");
  await userEvent.click(screen.getByRole("button", { name: /Запустить проверку/ }));
  return screen.findByTestId("m02-coverage");
}

describe("SourceCheckSection — правила §15", () => {
  it("показывает покрытие первым, до карточек источников", async () => {
    await startCheck();
    const coverageEl = screen.getByTestId("m02-coverage");
    const firstCard = screen.getAllByTestId("m02-source-card")[0];
    // Сводка обязана идти раньше карточек в порядке документа.
    expect(coverageEl.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(coverageEl).toHaveTextContent("Нельзя делать вывод об отсутствии записей");
  });

  it("частичная проверка не подаётся как чистый клиент", async () => {
    await startCheck();
    // Сводка не утверждает отсутствия записей.
    const summary = screen.getByTestId("m02-coverage").textContent ?? "";
    expect(summary).toMatch(/Нельзя делать вывод об отсутствии записей/);
    expect(summary).not.toMatch(/записей не найдено/i);

    // Ни один СТАТУС карточки не говорит «Записей не найдено». Вариант в
    // выпадающем списке — это то, что оператор МОЖЕТ наблюдать, а не
    // утверждение системы, поэтому сверяем именно статусы.
    for (const status of screen.getAllByTestId("m02-source-status")) {
      expect(status.textContent).not.toMatch(/записей не найдено/i);
    }

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/чист/i);
    expect(text).not.toMatch(/одобрен/i);
  });

  it("недоступный источник читается как недоступный, а не как «нет записей»", async () => {
    await startCheck();
    const cards = screen.getAllByTestId("m02-source-card");
    const kgd = cards.find((c) => c.textContent?.includes("КГД"))!;
    const status = within(kgd).getByTestId("m02-source-status");
    expect(status).toHaveTextContent("Источник недоступен");
    expect(status.textContent).not.toMatch(/записей не найдено/i);
  });

  it("состояние передаётся текстом, а не только цветом", async () => {
    await startCheck();
    expect(screen.getByText("Нужна ручная проверка")).toBeInTheDocument();
    expect(screen.getByText("Источник недоступен")).toBeInTheDocument();
  });

  it("каждая карточка несёт дисклеймер «факт ≠ решение банка»", async () => {
    await startCheck();
    const cards = screen.getAllByTestId("m02-source-card");
    for (const c of cards) {
      expect(c).toHaveTextContent("Факт источника — не решение банка.");
    }
  });

  it("подтверждение заблокировано, пока не введено доказательство", async () => {
    await startCheck();
    const confirm = screen.getByRole("button", { name: /Подтвердить проверку/ });
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/Без доказательства подтверждение не принимается/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/screenshot/), "screenshot://enis/1");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(api.confirmManualTask).toHaveBeenCalledWith("task_1", expect.objectContaining({
      evidence_ref: "screenshot://enis/1",
      outcome: "NOT_FOUND",
    }));
  });

  it("ручная карточка ведёт на официальный сайт без ИИН в ссылке", async () => {
    await startCheck();
    const link = screen.getByRole("link", { name: /Открыть официальный сервис/ });
    expect(link).toHaveAttribute("href", "https://enis.kz/");
    expect(link.getAttribute("href")).not.toMatch(/\d{12}/);
  });

  it("ИИН не остаётся на экране после запуска проверки", async () => {
    await startCheck();
    expect(document.body.textContent).not.toContain("900101300057");
    expect(screen.getByText(/••••••••••57/)).toBeInTheDocument();
  });

  it("найденный факт не показывается как отказ банка", async () => {
    api.getCheckResults.mockResolvedValue({
      batch_id: "batch_1",
      coverage: { ...coverage, completed: 7, found: 1, manual: 0, unavailable: 0, overallStatus: "COMPLETE_FACTS_FOUND", brokerText: "Проверка завершена. Найдены факты: 1. Это не решение банка." },
      overall_status: "COMPLETE_FACTS_FOUND",
      results: [result({
        status: "COMPLETED", outcome: "FOUND",
        human_text: "Найдена запись. Это факт официального источника, а не решение банка.",
        evidence: { reference: "ev://1", hash: null, present: true },
        manual_tasks: [],
      })],
    });
    await startCheck();
    expect(screen.getByText("Найдена запись")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/отказ|отклонен|запрещ/i);
    expect(text).toContain("не решение банка");
  });
});
