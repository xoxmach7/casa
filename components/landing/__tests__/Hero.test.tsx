import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Hero } from "../Hero";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Hero", () => {
  it("navigates to /otsenka with the entered address on submit", async () => {
    pushMock.mockClear();
    render(<Hero />);

    await userEvent.type(
      screen.getByLabelText("Адрес квартиры"),
      "Жошы хана 27"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Оценить бесплатно" })
    );

    expect(pushMock).toHaveBeenCalledWith(
      `/otsenka?address=${encodeURIComponent("Жошы хана 27")}`
    );
  });
});
