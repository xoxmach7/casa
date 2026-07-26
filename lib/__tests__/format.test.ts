import { describe, it, expect } from "vitest";
import { formatTenge } from "../format";

describe("formatTenge", () => {
  it("appends the tenge symbol and groups thousands", () => {
    const result = formatTenge(47046957);
    expect(result.endsWith("₸")).toBe(true);
    expect(result).not.toBe("47046957 ₸");
  });
});
