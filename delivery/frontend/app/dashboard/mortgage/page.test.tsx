import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MortgageWorkspacePage from "./page";

const mortgageCases = vi.hoisted(() => ({ createMortgageCase: vi.fn() }));
vi.mock("@/lib/mortgage/case-api", () => mortgageCases);

const client = { id: "client_1", firstName: "Айдана", lastName: "Серикова", phone: "+77010000000", status: "active" };

describe("MortgageWorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ clients: [client] }), { status: 200 })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lets the manager choose a real client instead of entering an opaque ID", async () => {
    mortgageCases.createMortgageCase.mockResolvedValue({ id: "case_1", client_id: "client_1", status: "DRAFT", version: 1 });
    render(<MortgageWorkspacePage />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Клиент"), "client_1");
    await user.click(screen.getByRole("button", { name: "Создать заявку" }));

    expect(mortgageCases.createMortgageCase).toHaveBeenCalledWith("client_1");
    expect(await screen.findByText("Заявка создана")).toBeInTheDocument();
  });

  it("does not block the application when external checks are not connected", async () => {
    render(<MortgageWorkspacePage />);
    await waitFor(() => expect(screen.getByLabelText("Клиент")).not.toBeDisabled());
    expect(screen.getByText(/Внешние проверки подключаются отдельно/i)).toBeInTheDocument();
    expect(screen.queryByText("Безопасный sandbox")).not.toBeInTheDocument();
  });
});
