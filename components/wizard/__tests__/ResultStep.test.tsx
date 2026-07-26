import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ResultStep } from "../ResultStep";
import { formatTenge } from "@/lib/format";

// formatTenge uses Intl.NumberFormat("ru-RU"), whose thousands separator is a
// non-breaking space (U+00A0). @testing-library/dom's exact string matcher
// normalizes whitespace on the rendered DOM text but not on the string passed
// to getByText, so a raw NBSP-containing search string never matches. We
// collapse whitespace here the same way the DOM-side normalizer does, so the
// comparison is apples-to-apples.
function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ");
}

describe("ResultStep", () => {
  it("shows both prices when valuation is ready", async () => {
    const onContinue = vi.fn();
    render(
      <ResultStep
        valuation={{
          status: "ready",
          basePricePerM2: 856957,
          instantPrice: Math.round(856957 * 61 * 0.9),
          marketPrice: Math.round(856957 * 61 * 0.93),
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
