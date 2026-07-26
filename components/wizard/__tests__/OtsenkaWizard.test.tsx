import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { OtsenkaWizard } from "../OtsenkaWizard";
import { formatTenge } from "@/lib/format";
import { normalizeSpaces } from "./testUtils";

let mockAddress = "Жошы хана 27";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ address: mockAddress }),
}));

describe("OtsenkaWizard", () => {
  it("walks through all four steps for a known address", async () => {
    mockAddress = "Жошы хана 27";
    render(<OtsenkaWizard />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Это мой дом, продолжить" })
    );

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "2");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "61");
    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

    expect(
      screen.getByText(normalizeSpaces(formatTenge(Math.round(856957 * 61 * 0.9))))
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

    expect(screen.getByText("Спасибо, Алибек!")).toBeInTheDocument();
  });

  it("walks through the insufficient-data path for an unrecognized address", async () => {
    mockAddress = "Несуществующая улица, 999";
    render(<OtsenkaWizard />);

    await userEvent.selectOptions(
      await screen.findByLabelText("Район"),
      "Есиль"
    );

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "2");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "61");
    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

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

    expect(screen.getByText("Спасибо, Алибек!")).toBeInTheDocument();
  });
});
