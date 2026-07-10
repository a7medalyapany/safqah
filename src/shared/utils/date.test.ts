import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, monthStart, toIsoDate, today } from "@/shared/utils/date";

describe("toIsoDate", () => {
  it("formats a local calendar date with zero padding", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the local day, not UTC", () => {
    // 23:30 local on the 5th is already the 6th in UTC for negative offsets;
    // the POS must report the shopkeeper's calendar day.
    expect(toIsoDate(new Date(2026, 6, 5, 23, 30))).toBe("2026-07-05");
  });
});

describe("today / monthStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 15, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("today returns the current local date", () => {
    expect(today()).toBe("2026-07-10");
  });

  it("monthStart returns the first of the current month", () => {
    expect(monthStart()).toBe("2026-07-01");
  });
});

describe("formatDate", () => {
  it("normalizes SQLite space-separated timestamps", () => {
    const formatted = formatDate("2026-07-10 14:30:00");

    // Rendered via ar-EG Intl; asserting it parsed (no fallthrough).
    expect(formatted).not.toBe("2026-07-10 14:30:00");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("returns unparseable input unchanged", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
