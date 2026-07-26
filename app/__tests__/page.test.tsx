import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LandingPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("LandingPage", () => {
  it("renders the hero heading and how-it-works section", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("Узнайте цену вашей квартиры за пару минут")
    ).toBeInTheDocument();
    expect(screen.getByText("Как это работает")).toBeInTheDocument();
  });
});
