import { describe, expect, it } from "vitest";
import { formatApplicationId, isApplicationId, parseApplicationId } from "@/lib/applications/application-id";

describe("application ID generation", () => {
  it("zero-pads to four digits", () => {
    expect(formatApplicationId(1)).toBe("APP-0001");
    expect(formatApplicationId(42)).toBe("APP-0042");
    expect(formatApplicationId(9999)).toBe("APP-9999");
  });

  it("grows beyond four digits without truncation", () => {
    expect(formatApplicationId(10000)).toBe("APP-10000");
  });

  it("rejects non-positive or fractional sequences", () => {
    expect(() => formatApplicationId(0)).toThrow(RangeError);
    expect(() => formatApplicationId(-1)).toThrow(RangeError);
    expect(() => formatApplicationId(1.5)).toThrow(RangeError);
  });

  it("parses identifiers back to their sequence", () => {
    expect(parseApplicationId("APP-0007")).toBe(7);
    expect(parseApplicationId(" app-12345 ")).toBe(12345);
    expect(parseApplicationId("APP-7")).toBeNull();
    expect(parseApplicationId("APP-0000")).toBeNull();
    expect(isApplicationId("XYZ-0001")).toBe(false);
  });

  it("round-trips", () => {
    for (const n of [1, 99, 1234, 56789]) expect(parseApplicationId(formatApplicationId(n))).toBe(n);
  });
});
