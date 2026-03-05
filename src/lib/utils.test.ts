import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./utils";

describe("formatRelativeTime", () => {
  it("returns 'never' for null", () => {
    expect(formatRelativeTime(null)).toBe("never");
  });

  it("returns 'unknown' for invalid date", () => {
    expect(formatRelativeTime("not-a-date")).toBe("unknown");
  });

  it("returns 'just now' for very recent timestamps", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("returns minutes for recent times", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours for same-day", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days for recent past", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    expect(formatRelativeTime(tenDaysAgo)).toBe("10d ago");
  });

  it("returns months for older dates", () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    expect(formatRelativeTime(sixtyDaysAgo)).toBe("2mo ago");
  });

  it("returns years for very old dates", () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000);
    expect(formatRelativeTime(twoYearsAgo)).toBe("2y ago");
  });

  it("accepts number timestamps", () => {
    const result = formatRelativeTime(Date.now() - 120_000);
    expect(result).toBe("2m ago");
  });
});
