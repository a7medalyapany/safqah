import { describe, expect, it } from "vitest";

import {
  ensureCashPaidAtLeastTotal,
  shouldSyncCashPaidToTotal,
} from "@/modules/pos/paymentRules";

describe("paymentRules", () => {
  it("keeps overpay in cash mode", () => {
    expect(ensureCashPaidAtLeastTotal(7000, 5000)).toBe(7000);
  });

  it("raises underpay to total", () => {
    expect(ensureCashPaidAtLeastTotal(3000, 5000)).toBe(5000);
  });

  it("syncs when cash paid is below total", () => {
    expect(
      shouldSyncCashPaidToTotal({
        paymentMethod: "cash",
        paidCashMillieme: 3000,
        totalMillieme: 5000,
        paidCashManuallySet: false,
      }),
    ).toBe(true);
  });

  it("syncs down when auto-filled cash exceeds total after removing items", () => {
    expect(
      shouldSyncCashPaidToTotal({
        paymentMethod: "cash",
        paidCashMillieme: 7000,
        totalMillieme: 5000,
        paidCashManuallySet: false,
      }),
    ).toBe(true);
  });

  it("keeps a manual overpay when total drops", () => {
    expect(
      shouldSyncCashPaidToTotal({
        paymentMethod: "cash",
        paidCashMillieme: 7000,
        totalMillieme: 5000,
        paidCashManuallySet: true,
      }),
    ).toBe(false);
  });

  it("syncs a manual amount up when total rises above it", () => {
    expect(
      shouldSyncCashPaidToTotal({
        paymentMethod: "cash",
        paidCashMillieme: 5000,
        totalMillieme: 7000,
        paidCashManuallySet: true,
      }),
    ).toBe(true);
  });

  it("does not sync when cash paid already matches total", () => {
    expect(
      shouldSyncCashPaidToTotal({
        paymentMethod: "cash",
        paidCashMillieme: 5000,
        totalMillieme: 5000,
        paidCashManuallySet: false,
      }),
    ).toBe(false);
  });

  it("does not sync for non-cash methods", () => {
    expect(
      shouldSyncCashPaidToTotal({
        paymentMethod: "card",
        paidCashMillieme: 0,
        totalMillieme: 5000,
        paidCashManuallySet: false,
      }),
    ).toBe(false);
  });
});
