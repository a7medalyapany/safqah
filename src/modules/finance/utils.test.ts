import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDateRange, relativeTime } from "@/modules/finance/utils";

describe("getDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Friday 2026-07-10
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns open bounds for 'all'", () => {
    expect(getDateRange("all")).toEqual({ dateFrom: null, dateTo: null });
  });

  it("starts today at the current date", () => {
    expect(getDateRange("today")).toEqual({ dateFrom: "2026-07-10", dateTo: null });
  });

  it("starts the week on Monday", () => {
    expect(getDateRange("week")).toEqual({ dateFrom: "2026-07-06", dateTo: null });
  });

  it("treats Sunday as belonging to the previous Monday-start week", () => {
    vi.setSystemTime(new Date(2026, 6, 12, 12, 0)); // Sunday
    expect(getDateRange("week")).toEqual({ dateFrom: "2026-07-06", dateTo: null });
  });

  it("starts the month on the first", () => {
    expect(getDateRange("month")).toEqual({ dateFrom: "2026-07-01", dateTo: null });
  });
});

describe("relativeTime", () => {
  it("labels today and yesterday", () => {
    expect(relativeTime(0)).toBe("اليوم");
    expect(relativeTime(1)).toBe("أمس");
  });

  it("counts days under a week", () => {
    expect(relativeTime(5)).toBe("5 أيام");
  });

  it("rolls up to weeks, months, and years", () => {
    expect(relativeTime(14)).toBe("2 أسبوع");
    expect(relativeTime(90)).toBe("3 شهر");
    expect(relativeTime(800)).toBe("2 سنة");
  });
});
