import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MortgagePage from "./page";

describe("MortgagePage — каноническая структура (демо-режим 1.1 удалён)", () => {
  it("показывает разрешённые секции: профиль (M05) и расчёт (M06)", () => {
    render(<MortgagePage />);
    expect(screen.getByRole("heading", { name: "Ипотечное решение клиента" })).toBeInTheDocument();
    expect(screen.getByText(/Профиль клиента/)).toBeInTheDocument();
    expect(screen.getByText("Требуемое финансирование")).toBeInTheDocument();
    expect(screen.getByText("Ежемесячный платёж (аннуитет)")).toBeInTheDocument();
    expect(screen.getByText(/available_now_total/)).toBeInTheDocument();
  });

  it("НЕ содержит запрещённых демо-выходов (принимаемый доход, число программ, сценарии)", () => {
    render(<MortgagePage />);
    expect(screen.queryByText(/принимаемый доход/i)).toBeNull();
    expect(screen.queryByText(/программ открыл|число программ|программ подходит/i)).toBeNull();
    expect(screen.queryByText(/сценари/i)).toBeNull();
  });
});
