import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MortgageWorkspacePage from "./page";

const api = vi.hoisted(() => ({
  getMortgageSandboxStatus: vi.fn(), uploadMortgageSandboxDocument: vi.fn(), checkMortgageSandboxIin: vi.fn(),
  getMortgageSandboxAnalysis: vi.fn(), previewMortgageSandboxScenario: vi.fn(), confirmMortgageSandboxDocument: vi.fn(),
}));
vi.mock("@/lib/mortgage/sandbox-api", () => api);

describe("MortgageWorkspacePage sandbox", () => {
  beforeEach(() => { vi.clearAllMocks(); api.getMortgageSandboxStatus.mockResolvedValue({ mode: "synthetic", policyVersion: "2026-08-24" }); });

  it("keeps the secure sandbox banner visible and prevents uploading without acknowledgement", async () => {
    render(<MortgageWorkspacePage />);
    expect(await screen.findByText("Безопасный sandbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Загрузить PDF" })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/подтверждаю/i));
    await user.upload(screen.getByLabelText("PDF файл"), new File(["%PDF- synthetic"], "synthetic.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("button", { name: "Загрузить PDF" })).toBeEnabled();
  });

  it("uses the backend IIN check and never claims an official registry response", async () => {
    api.checkMortgageSandboxIin.mockResolvedValue({ shapeValid: true, checksumValid: true, externalSourceStatus: "EXTERNAL_SOURCE_NOT_CONNECTED", officialResult: null });
    render(<MortgageWorkspacePage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Синтетический ИИН"), "900101300123");
    await user.click(screen.getByRole("button", { name: "Проверить структуру ИИН" }));
    expect(api.checkMortgageSandboxIin).toHaveBeenCalledWith("900101300123");
    expect(await screen.findByText("Контрольная сумма: корректна")).toBeInTheDocument();
    expect(screen.getByText("EXTERNAL_SOURCE_NOT_CONNECTED")).toBeInTheDocument();
    expect(screen.queryByText(/официально проверен/i)).not.toBeInTheDocument();
  });

  it("fills only a synthetic questionnaire and does not fabricate documents, consent, or analysis", async () => {
    render(<MortgageWorkspacePage />);
    await userEvent.click(screen.getByRole("button", { name: "Заполнить демо" }));
    expect(screen.getByDisplayValue("Синтетический клиент CASA")).toBeInTheDocument();
    expect(screen.getByText("Документы не загружены")).toBeInTheDocument();
    expect(screen.getByText("Согласие: требуется интеграция провайдера")).toBeInTheDocument();
    expect(api.getMortgageSandboxAnalysis).not.toHaveBeenCalled();
  });
});