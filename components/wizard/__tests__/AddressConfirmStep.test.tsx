import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AddressConfirmStep } from "../AddressConfirmStep";

describe("AddressConfirmStep", () => {
  it("calls onConfirm with the match when the user confirms a found address", async () => {
    const onConfirm = vi.fn();
    const match = {
      status: "matched" as const,
      residentialComplex: "Prime Garden",
      district: "Есиль",
      address: "Жошы хана 27",
      buildingClass: "comfort_plus" as const,
    };

    render(
      <AddressConfirmStep address="Жошы хана 27" match={match} onConfirm={onConfirm} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Это мой дом, продолжить" })
    );

    expect(onConfirm).toHaveBeenCalledWith(match);
  });

  it("lets the user pick a district manually when the address is not found", async () => {
    const onConfirm = vi.fn();

    render(
      <AddressConfirmStep
        address="Неизвестная 1"
        match={{ status: "not_found" }}
        onConfirm={onConfirm}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Район"), "Есиль");

    expect(onConfirm).toHaveBeenCalledWith({
      status: "matched",
      residentialComplex: "уточняется",
      district: "Есиль",
      address: "Неизвестная 1",
      buildingClass: "comfort",
    });
  });
});
