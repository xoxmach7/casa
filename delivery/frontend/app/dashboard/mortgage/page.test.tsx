import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MortgageWorkspacePage from "./page";

describe("MortgageWorkspacePage", () => {
  it("preserves the established mortgage workspace and starts with an active client action", () => {
    render(<MortgageWorkspacePage />);

    expect(screen.getByRole("heading", { name: "Ипотечное решение клиента" })).toBeInTheDocument();
    expect(screen.getAllByText("Клиент не выбран")).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Выбрать клиента" }).some((button) => !button.hasAttribute("disabled"))).toBe(true);
  });
});
