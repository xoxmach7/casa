import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ResultStep } from "../ResultStep";
import { formatTenge } from "@/lib/format";
import { normalizeSpaces } from "./testUtils";

describe("ResultStep", () => {
  it("shows both prices when valuation is ready", async () => {
    const onContinue = vi.fn();
    render(
      <ResultStep
        valuation={{
          status: "ready",
          marketValue: Math.round(856957 * 61),
          urgentPrice: Math.round(856957 * 61 * 0.9),
          marketPrice: Math.round(856957 * 61 * 0.93),
          comparablesCount: 12,
        }}
        onContinue={onContinue}
      />
    );

    expect(
      screen.getByText(normalizeSpaces(formatTenge(Math.round(856957 * 61 * 0.9))))
    ).toBeInTheDocument();
    expect(
      screen.getByText(normalizeSpaces(formatTenge(Math.round(856957 * 61 * 0.93))))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows an insufficient data message when valuation is not ready", () => {
    render(
      <ResultStep valuation={{ status: "insufficient_data" }} onContinue={vi.fn()} />
    );

    expect(
      screen.getByText("Пока не можем точно оценить эту квартиру")
    ).toBeInTheDocument();
  });
});
