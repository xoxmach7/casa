import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ContactStep } from "../ContactStep";

describe("ContactStep", () => {
  it("does not submit without consent", async () => {
    const onSubmit = vi.fn();
    render(<ContactStep onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits name and phone once consent is checked", async () => {
    const onSubmit = vi.fn();
    render(<ContactStep onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(
      screen.getByLabelText("Согласен(а) на обработку персональных данных")
    );
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Алибек",
      phone: "+77009170103",
    });
  });
});
