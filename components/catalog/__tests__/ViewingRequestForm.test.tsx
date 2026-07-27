import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewingRequestForm } from "../ViewingRequestForm";

vi.mock("@/lib/api/procasa-client", () => ({
  submitViewingRequest: vi.fn().mockResolvedValue(true),
}));

import { submitViewingRequest } from "@/lib/api/procasa-client";

describe("ViewingRequestForm", () => {
  it("submits name, phone and propertyId, then shows a confirmation", async () => {
    const user = userEvent.setup();
    render(<ViewingRequestForm propertyId="p1" />);

    await user.type(screen.getByLabelText("Имя"), "Аружан");
    await user.type(screen.getByLabelText("Телефон"), "+77001234567");
    fireEvent.click(screen.getByRole("button", { name: /записаться на просмотр/i }));

    await waitFor(() => {
      expect(submitViewingRequest).toHaveBeenCalledWith({
        propertyId: "p1",
        name: "Аружан",
        phone: "+77001234567",
      });
    });
    expect(await screen.findByText(/заявка отправлена/i)).toBeInTheDocument();
  });
});
