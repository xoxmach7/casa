import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuyerPreferencesForm } from "../BuyerPreferencesForm";

vi.mock("@/lib/api/procasa-client", () => ({
  submitBuyerLead: vi.fn(),
}));

import { submitBuyerLead } from "@/lib/api/procasa-client";

describe("BuyerPreferencesForm", () => {
  it("submits name, phone, district, selected rooms and budget, then shows a success message", async () => {
    (submitBuyerLead as any).mockResolvedValue({ success: true, buyerId: "buyer_1" });
    const user = userEvent.setup();

    render(<BuyerPreferencesForm />);

    await user.type(screen.getByLabelText("Имя"), "Ержан");
    await user.type(screen.getByLabelText("Телефон"), "+77009998877");
    await user.selectOptions(screen.getByLabelText("Район"), "Бостандыкский");
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.type(screen.getByLabelText("Бюджет от"), "25000000");
    await user.type(screen.getByLabelText("Бюджет до"), "40000000");

    fireEvent.click(screen.getByRole("button", { name: /уведомить меня/i }));

    await waitFor(() => {
      expect(submitBuyerLead).toHaveBeenCalledWith({
        name: "Ержан",
        phone: "+77009998877",
        district: "Бостандыкский",
        rooms: [2, 3],
        minBudget: 25_000_000,
        maxBudget: 40_000_000,
      });
    });

    await screen.findByText(/заявка принята/i);
  });

  it("shows an error message when submission fails", async () => {
    (submitBuyerLead as any).mockResolvedValue({ success: false });
    const user = userEvent.setup();

    render(<BuyerPreferencesForm />);

    await user.type(screen.getByLabelText("Имя"), "Ержан");
    await user.type(screen.getByLabelText("Телефон"), "+77009998877");
    fireEvent.click(screen.getByRole("button", { name: /уведомить меня/i }));

    await screen.findByText(/не удалось отправить заявку/i);
  });
});
