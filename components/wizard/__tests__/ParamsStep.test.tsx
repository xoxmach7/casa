import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ParamsStep } from "../ParamsStep";

describe("ParamsStep", () => {
  it("submits the entered parameters", async () => {
    const onSubmit = vi.fn();
    render(<ParamsStep onSubmit={onSubmit} />);

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "3");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "94");
    await userEvent.selectOptions(
      screen.getByLabelText("Состояние ремонта"),
      "fresh_repair"
    );

    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

    expect(onSubmit).toHaveBeenCalledWith({
      rooms: 3,
      areaM2: 94,
      floor: 5,
      totalFloors: 9,
      repairCondition: "fresh_repair",
    });
  });
});
