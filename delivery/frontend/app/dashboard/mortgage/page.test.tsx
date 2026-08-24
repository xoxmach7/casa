import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MortgageWorkspacePage from "./page";

const mortgageCases = vi.hoisted(() => ({ createMortgageCase: vi.fn() }));
vi.mock("@/lib/mortgage/case-api", () => mortgageCases);

describe("MortgageWorkspacePage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a working internal mortgage case for an existing client", async () => {
    mortgageCases.createMortgageCase.mockResolvedValue({ id: "case_1", client_id: "client_1", status: "DRAFT", version: 1 });
    render(<MortgageWorkspacePage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("ID клиента"), "client_1");
    await user.click(screen.getByRole("button", { name: "Создать заявку" }));

    expect(mortgageCases.createMortgageCase).toHaveBeenCalledWith("client_1");
    expect(await screen.findByText("Заявка создана" )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сформировать PDF" })).toBeEnabled();
  });

  it("does not block the application when external checks are not connected", () => {
    render(<MortgageWorkspacePage />);
    expect(screen.getByText(/Внешние проверки подключаются отдельно/i)).toBeInTheDocument();
    expect(screen.queryByText("Безопасный sandbox")).not.toBeInTheDocument();
  });
});