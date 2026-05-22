import { describe, expect, it } from "vitest";

import { type Item } from "@/modules/items/types";
import { createCartStore } from "@/store/cartSlice";

const makeItem = (overrides: Partial<Item>): Item => ({
  id: 0,
  barcode: "000",
  name_ar: "منتج",
  name_en: null,
  category_id: null,
  buy_price_millieme: 0,
  sell_price_millieme: 0,
  color: null,
  size: null,
  unit: "piece",
  min_stock: 0,
  current_stock: 0,
  supplier_id: null,
  image_path: null,
  is_active: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("cartSlice", () => {
  it("adds 3 different items and computes subtotal", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ id: 1, sell_price_millieme: 1000 }));
    store.getState().addItem(makeItem({ id: 2, sell_price_millieme: 2500 }));
    store.getState().addItem(makeItem({ id: 3, sell_price_millieme: 3300 }));

    expect(store.getState().items).toHaveLength(3);
    expect(store.getState().subtotalMillieme()).toBe(6800);
  });

  it("increments qty when the same item is added twice", () => {
    const store = createCartStore();
    const item = makeItem({
      id: 1,
      barcode: "12345",
      name_ar: "قلم",
      sell_price_millieme: 1500,
    });

    store.getState().addItem(item);
    store.getState().addItem(item);

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]).toMatchObject({
      itemId: 1,
      qty: 2,
      totalMillieme: 3000,
    });
  });

  it("applies a line discount and reduces line total", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ id: 1, sell_price_millieme: 5000 }));
    store.getState().updateLineDiscount(1, 1200);

    expect(store.getState().items[0]).toMatchObject({
      discountMillieme: 1200,
      totalMillieme: 3800,
    });
    expect(store.getState().subtotalMillieme()).toBe(3800);
  });

  it("applies a global discount and reduces total", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ id: 1, sell_price_millieme: 5000 }));
    store.getState().addItem(makeItem({ id: 2, sell_price_millieme: 2000 }));
    store.getState().setGlobalDiscount(900);

    expect(store.getState().subtotalMillieme()).toBe(7000);
    expect(store.getState().totalDiscountMillieme()).toBe(900);
    expect(store.getState().totalMillieme()).toBe(6100);
  });

  it("removes an item when updateQty is called with 0", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ id: 1, sell_price_millieme: 1000 }));
    store.getState().addItem(makeItem({ id: 2, sell_price_millieme: 2000 }));
    store.getState().updateQty(1, 0);

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].itemId).toBe(2);
  });

  it("clears the cart back to initial state", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ id: 1, sell_price_millieme: 1000 }));
    store.getState().setCustomer(7, "عميل");
    store.getState().setGlobalDiscount(300);
    store.getState().setPaymentMethod("split");
    store.getState().setPaidCashAmount(5000);
    store.getState().setPaidCardAmount(1000);
    store.getState().setNotes("test");
    store.getState().clearCart();

    expect(store.getState().items).toEqual([]);
    expect(store.getState().customerId).toBeNull();
    expect(store.getState().customerName).toBeNull();
    expect(store.getState().globalDiscountMillieme).toBe(0);
    expect(store.getState().paymentMethod).toBe("cash");
    expect(store.getState().paidCashMillieme).toBe(0);
    expect(store.getState().paidCardMillieme).toBe(0);
    expect(store.getState().notes).toBe("");
    expect(store.getState().subtotalMillieme()).toBe(0);
    expect(store.getState().totalDiscountMillieme()).toBe(0);
    expect(store.getState().totalMillieme()).toBe(0);
  });

  it("computes change as paid minus total for overpay and exact pay", () => {
    const store = createCartStore();

    store.getState().addItem(makeItem({ id: 1, sell_price_millieme: 4000 }));
    store.getState().setPaidCashAmount(5000);
    expect(store.getState().changeMillieme()).toBe(1000);

    store.getState().setPaidCashAmount(4000);
    expect(store.getState().changeMillieme()).toBe(0);
  });
});
