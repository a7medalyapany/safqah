import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSalesTrend, lastDays } from "@/modules/dashboard/utils";

describe("lastDays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 9, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces the requested number of days ending today, oldest first", () => {
    const days = lastDays(7);

    expect(days).toHaveLength(7);
    expect(days[0].iso).toBe("2026-07-04");
    expect(days[6].iso).toBe("2026-07-10");
  });

  it("crosses month boundaries correctly", () => {
    const days = lastDays(14);

    expect(days[0].iso).toBe("2026-06-27");
  });
});

describe("buildSalesTrend", () => {
  const days = [
    { iso: "2026-07-08", label: "٨ يوليو" },
    { iso: "2026-07-09", label: "٩ يوليو" },
    { iso: "2026-07-10", label: "١٠ يوليو" },
  ];

  it("matches rows to days and fills gaps with zero", () => {
    const trend = buildSalesTrend(days, [
      { period_label: "2026-07-08", total_millieme: 250_000, invoice_count: 3, discount_millieme: 0 },
      { period_label: "2026-07-10", total_millieme: 100_000, invoice_count: 1, discount_millieme: 0 },
    ]);

    expect(trend.map((p) => p.total_millieme)).toEqual([250_000, 0, 100_000]);
    expect(trend[0].total_egp).toBe(250);
  });

  it("matches rows whose period label carries a time component", () => {
    const trend = buildSalesTrend(days, [
      { period_label: "2026-07-09 00:00:00", total_millieme: 75_000, invoice_count: 2, discount_millieme: 0 },
    ]);

    expect(trend[1].total_millieme).toBe(75_000);
  });
});
