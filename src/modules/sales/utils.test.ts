import { describe, expect, it } from "vitest";

import {
  buildFilters,
  getRemainingMillieme,
  getReturnLineRefundMillieme,
  getReturnableQty,
} from "@/modules/sales/utils";

describe("buildFilters", () => {
  it("nulls out empty and whitespace-only filter values", () => {
    const filters = buildFilters({
      dateFrom: "",
      dateTo: "",
      customerSearch: "   ",
      invoiceSearch: "",
      status: "",
      paymentMethod: "",
      limit: 50,
      offset: 0,
    });

    expect(filters).toEqual({
      dateFrom: null,
      dateTo: null,
      customerSearch: null,
      invoiceSearch: null,
      status: null,
      paymentMethod: null,
      limit: 50,
      offset: 0,
    });
  });

  it("trims searches and passes populated values through", () => {
    const filters = buildFilters({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-10",
      customerSearch: " أحمد ",
      invoiceSearch: " INV-7 ",
      status: "paid",
      paymentMethod: "cash",
      limit: 20,
      offset: 40,
    });

    expect(filters.customerSearch).toBe("أحمد");
    expect(filters.invoiceSearch).toBe("INV-7");
    expect(filters.dateFrom).toBe("2026-07-01");
    expect(filters.status).toBe("paid");
  });
});

describe("getRemainingMillieme", () => {
  it("returns the unpaid balance", () => {
    expect(
      getRemainingMillieme({ total_millieme: 150_000, paid_millieme: 100_000 }),
    ).toBe(50_000);
  });

  it("clamps overpayment to zero instead of going negative", () => {
    expect(
      getRemainingMillieme({ total_millieme: 100_000, paid_millieme: 120_000 }),
    ).toBe(0);
  });
});

describe("getReturnableQty", () => {
  it("subtracts already-returned quantity", () => {
    expect(getReturnableQty({ qty: 5, returned_qty: 2 })).toBe(3);
  });

  it("clamps to zero when everything was returned", () => {
    expect(getReturnableQty({ qty: 3, returned_qty: 3 })).toBe(0);
  });
});

describe("getReturnLineRefundMillieme", () => {
  it("refunds the full line total for a full return with no global discount", () => {
    const refund = getReturnLineRefundMillieme(
      { qty: 3, total_millieme: 30_000 },
      3,
      100_000,
      100_000,
    );

    expect(refund).toBe(30_000);
  });

  it("prorates partial returns", () => {
    const refund = getReturnLineRefundMillieme(
      { qty: 3, total_millieme: 30_000 },
      1,
      100_000,
      100_000,
    );

    expect(refund).toBe(10_000);
  });

  it("scales down by the invoice-level discount", () => {
    // 10% global discount: total is 90% of subtotal.
    const refund = getReturnLineRefundMillieme(
      { qty: 2, total_millieme: 20_000 },
      2,
      100_000,
      90_000,
    );

    expect(refund).toBe(18_000);
  });

  it("returns zero for a zero-quantity line", () => {
    expect(
      getReturnLineRefundMillieme({ qty: 0, total_millieme: 0 }, 1, 100_000, 100_000),
    ).toBe(0);
  });

  it("survives a zero subtotal without dividing by zero", () => {
    expect(
      getReturnLineRefundMillieme({ qty: 1, total_millieme: 0 }, 1, 0, 0),
    ).toBe(0);
  });
});
