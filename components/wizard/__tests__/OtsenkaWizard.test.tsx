import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtsenkaWizard } from "../OtsenkaWizard";
import { formatTenge } from "@/lib/format";
import { normalizeSpaces } from "./testUtils";
import { getValuation, submitLeadForm } from "@/lib/api/procasa-client";

let mockAddress = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ address: mockAddress }),
}));

vi.mock("@/lib/api/procasa-client", () => ({
  getValuation: vi.fn(),
  submitLeadForm: vi.fn().mockResolvedValue(true),
}));

const mockGetValuation = vi.mocked(getValuation);
const mockSubmitLeadForm = vi.mocked(submitLeadForm);

describe("OtsenkaWizard", () => {
  beforeEach(() => {
    mockGetValuation.mockReset();
    mockSubmitLeadForm.mockReset();
    mockSubmitLeadForm.mockResolvedValue(true);
  });

  it("walks through all four steps when a valuation is ready", async () => {
    mockAddress = "Достык 5";
    mockGetValuation.mockResolvedValue({
      status: "ready",
      marketValue: Math.round(856957 * 61),
      urgentPrice: Math.round(856957 * 61 * 0.9),
      marketPrice: Math.round(856957 * 61 * 0.93),
      comparablesCount: 12,
    });

    render(<OtsenkaWizard />);

    await userEvent.selectOptions(await screen.findByLabelText("Район"), "Бостандыкский");
    await userEvent.clear(screen.getByLabelText("ЖК / адрес"));
    await userEvent.type(screen.getByLabelText("ЖК / адрес"), "Достык 5");
    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "2");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "61");
    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

    expect(mockGetValuation).toHaveBeenCalledWith({
      district: "Бостандыкский",
      rooms: 2,
      area: 61,
    });

    expect(
      await screen.findByText(normalizeSpaces(formatTenge(Math.round(856957 * 61 * 0.9))))
    ).toBeInTheDocument();
    expect(
      screen.getByText(normalizeSpaces(formatTenge(Math.round(856957 * 61 * 0.93))))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(
      screen.getByLabelText("Согласен(а) на обработку персональных данных")
    );
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(await screen.findByText("Спасибо, Алибек!")).toBeInTheDocument();
  });

  it("shows the insufficient-data message when the API can't price the apartment", async () => {
    mockAddress = "";
    mockGetValuation.mockResolvedValue({ status: "insufficient_data" });

    render(<OtsenkaWizard />);

    await userEvent.selectOptions(await screen.findByLabelText("Район"), "Алмалинский");
    await userEvent.type(screen.getByLabelText("ЖК / адрес"), "ЖК Тест");
    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "2");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "61");
    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

    expect(
      await screen.findByText("Данных пока недостаточно")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Пока не можем точно оценить эту квартиру")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Оставить контакты" }));

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(
      screen.getByLabelText("Согласен(а) на обработку персональных данных")
    );
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(await screen.findByText("Спасибо, Алибек!")).toBeInTheDocument();
  });
});
