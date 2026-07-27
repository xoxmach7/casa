import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyLeadWizard } from "../PropertyLeadWizard";

vi.mock("@/lib/api/procasa-client", () => ({
  submitPropertyLead: vi.fn().mockResolvedValue({ success: true, sellerId: "s1" }),
}));

import { submitPropertyLead } from "@/lib/api/procasa-client";

describe("PropertyLeadWizard", () => {
  it("walks through all 4 steps and submits the collected data", async () => {
    const user = userEvent.setup();
    render(<PropertyLeadWizard />);

    // Step 1: location
    await user.selectOptions(screen.getByLabelText("Район"), "Бостандыкский");
    await user.type(screen.getByLabelText("ЖК"), "Comfort City");
    await user.type(screen.getByLabelText("Адрес"), "ул. Розыбакиева");
    await user.type(screen.getByLabelText("Номер дома"), "100");
    fireEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // Step 2: price
    await user.type(screen.getByLabelText("Цена продажи"), "36000000");
    fireEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // Step 3: details
    await user.type(screen.getByLabelText("Количество комнат"), "2");
    await user.type(screen.getByLabelText("Площадь, м²"), "60");
    fireEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // Step 4: photos + contact
    await user.type(screen.getByLabelText("Имя"), "Аружан");
    await user.type(screen.getByLabelText("Телефон"), "+77001234567");
    fireEvent.click(screen.getByRole("button", { name: /отправить/i }));

    await waitFor(() => {
      expect(submitPropertyLead).toHaveBeenCalledWith(
        expect.objectContaining({
          district: "Бостандыкский",
          residentialComplex: "Comfort City",
          address: "ул. Розыбакиева",
          houseNumber: "100",
          price: 36_000_000,
          rooms: 2,
          area: 60,
          contactName: "Аружан",
          contactPhone: "+77001234567",
        })
      );
    });

    expect(await screen.findByText(/заявка принята/i)).toBeInTheDocument();
  });
});
