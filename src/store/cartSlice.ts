import { create, type StateCreator } from "zustand";
import { createStore } from "zustand/vanilla";

import { type Item } from "@/modules/items/types";

export interface CartItem {
  itemId: number;
  barcode: string;
  nameAr: string;
  qty: number;
  buyPriceMillieme: number;
  unitPriceMillieme: number;
  discountPercent: number;
  discountMillieme: number;
  totalMillieme: number;
}

type CartItemOverrides = {
  unitPriceMillieme?: number;
  discountPercent?: number;
};

export interface CartState {
  items: CartItem[];
  customerId: number | null;
  customerName: string | null;
  globalDiscountMillieme: number;
  paymentMethod: "cash" | "card" | "deferred" | "split";
  paidCashMillieme: number;
  paidCardMillieme: number;
  notes: string;
  subtotalMillieme: () => number;
  minimumSubtotalMillieme: () => number;
  totalDiscountMillieme: () => number;
  totalMillieme: () => number;
  changeMillieme: () => number;
  addItem: (item: Item, overrides?: CartItemOverrides) => void;
  removeItem: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  updateLineDiscountPercent: (itemId: number, discountPercent: number) => void;
  updateLineDiscount: (itemId: number, discountMillieme: number) => void;
  updateLineUnitPrice: (itemId: number, unitPriceMillieme: number) => void;
  setGlobalDiscount: (discountMillieme: number) => void;
  setCustomer: (id: number, name: string) => void;
  clearCustomer: () => void;
  setPaymentMethod: (method: CartState["paymentMethod"]) => void;
  setPaidCashAmount: (milliemes: number) => void;
  setPaidCardAmount: (milliemes: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

const toInteger = (value: number) => Math.trunc(value);

const clampNonNegativeInteger = (value: number) =>
  Math.max(0, toInteger(value));

const clampPercent = (value: number) =>
  Math.min(100, clampNonNegativeInteger(value));

const computeLineDiscountMillieme = (
  qty: number,
  unitPriceMillieme: number,
  discountPercent: number,
) => Math.max(0, Math.trunc((unitPriceMillieme * qty * discountPercent) / 100));

const computeLineTotal = (
  qty: number,
  unitPriceMillieme: number,
  discountPercent: number,
) =>
  Math.max(
    0,
    unitPriceMillieme * qty -
      computeLineDiscountMillieme(qty, unitPriceMillieme, discountPercent),
  );

const computeSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.totalMillieme, 0);

const computeMinimumSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.buyPriceMillieme * item.qty, 0);

const normalizeLine = ({
  qty,
  unitPriceMillieme,
  discountPercent,
  buyPriceMillieme,
}: {
  qty: number;
  unitPriceMillieme: number;
  discountPercent: number;
  buyPriceMillieme: number;
}) => {
  const safeQty = Math.max(1, clampNonNegativeInteger(qty));
  const safeBuyPriceMillieme = Math.max(
    0,
    clampNonNegativeInteger(buyPriceMillieme),
  );
  const safeUnitPriceMillieme = Math.max(
    safeBuyPriceMillieme,
    clampNonNegativeInteger(unitPriceMillieme),
  );
  let safeDiscountPercent = clampPercent(discountPercent);

  while (
    safeDiscountPercent > 0 &&
    computeLineTotal(safeQty, safeUnitPriceMillieme, safeDiscountPercent) <
      safeBuyPriceMillieme * safeQty
  ) {
    safeDiscountPercent -= 1;
  }

  const discountMillieme = computeLineDiscountMillieme(
    safeQty,
    safeUnitPriceMillieme,
    safeDiscountPercent,
  );
  const totalMillieme = computeLineTotal(
    safeQty,
    safeUnitPriceMillieme,
    safeDiscountPercent,
  );

  return {
    qty: safeQty,
    unitPriceMillieme: safeUnitPriceMillieme,
    discountPercent: safeDiscountPercent,
    discountMillieme,
    totalMillieme,
  };
};

const toCartItem = (
  item: Item,
  overrides: CartItemOverrides = {},
): CartItem => {
  const buyPriceMillieme = toInteger(item.buy_price_millieme);
  const line = normalizeLine({
    qty: 1,
    unitPriceMillieme: overrides.unitPriceMillieme ?? item.sell_price_millieme,
    discountPercent: overrides.discountPercent ?? 0,
    buyPriceMillieme,
  });

  return {
    itemId: item.id,
    barcode: item.barcode ?? "",
    nameAr: item.name_ar,
    qty: line.qty,
    buyPriceMillieme,
    unitPriceMillieme: line.unitPriceMillieme,
    discountPercent: line.discountPercent,
    discountMillieme: line.discountMillieme,
    totalMillieme: line.totalMillieme,
  };
};

const initialCartState = {
  items: [],
  customerId: null,
  customerName: null,
  globalDiscountMillieme: 0,
  paymentMethod: "cash" as const,
  paidCashMillieme: 0,
  paidCardMillieme: 0,
  notes: "",
};

const createCartState: StateCreator<CartState> = (set, get) => ({
  ...initialCartState,
  subtotalMillieme: () =>
    get().items.reduce((sum, item) => sum + item.totalMillieme, 0),
  minimumSubtotalMillieme: () =>
    get().items.reduce(
      (sum, item) => sum + item.buyPriceMillieme * item.qty,
      0,
    ),
  totalDiscountMillieme: () =>
    get().items.reduce((sum, item) => sum + item.discountMillieme, 0) +
    get().globalDiscountMillieme,
  totalMillieme: () =>
    Math.max(0, get().subtotalMillieme() - get().globalDiscountMillieme),
  changeMillieme: () =>
    get().paymentMethod === "cash"
      ? get().paidCashMillieme - get().totalMillieme()
      : 0,
  addItem: (item, overrides) => {
    set((state) => {
      const existingItem = state.items.find(
        (cartItem) => cartItem.itemId === item.id,
      );

      if (!existingItem) {
        const items = [...state.items, toCartItem(item, overrides)];
        return {
          items,
          globalDiscountMillieme: Math.min(
            state.globalDiscountMillieme,
            Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
          ),
        };
      }

      const qty = existingItem.qty + 1;
      const items = state.items.map((cartItem) =>
        cartItem.itemId === item.id
          ? {
              ...cartItem,
              ...normalizeLine({
                qty,
                unitPriceMillieme: cartItem.unitPriceMillieme,
                discountPercent: cartItem.discountPercent,
                buyPriceMillieme: cartItem.buyPriceMillieme,
              }),
            }
          : cartItem,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
        ),
      };
    });
  },
  removeItem: (itemId) => {
    set((state) => {
      const items = state.items.filter((item) => item.itemId !== itemId);
      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
        ),
      };
    });
  },
  updateQty: (itemId, qty) => {
    const nextQty = clampNonNegativeInteger(qty);

    if (nextQty === 0) {
      get().removeItem(itemId);
      return;
    }

    set((state) => {
      const items = state.items.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              ...normalizeLine({
                qty: nextQty,
                unitPriceMillieme: item.unitPriceMillieme,
                discountPercent: item.discountPercent,
                buyPriceMillieme: item.buyPriceMillieme,
              }),
            }
          : item,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
        ),
      };
    });
  },
  updateLineDiscountPercent: (itemId, discountPercent) => {
    set((state) => {
      const items = state.items.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              ...normalizeLine({
                qty: item.qty,
                unitPriceMillieme: item.unitPriceMillieme,
                discountPercent,
                buyPriceMillieme: item.buyPriceMillieme,
              }),
            }
          : item,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
        ),
      };
    });
  },
  updateLineDiscount: (itemId, discountMillieme) => {
    set((state) => {
      const item = state.items.find((i) => i.itemId === itemId);
      if (!item) return state;

      const safeDiscount = clampNonNegativeInteger(discountMillieme);
      const maxDiscount = item.unitPriceMillieme * item.qty;
      const clampedDiscount = Math.min(safeDiscount, maxDiscount);

      const discountPercent =
        maxDiscount === 0
          ? 0
          : Math.floor((clampedDiscount / maxDiscount) * 100);

      const items = state.items.map((i) =>
        i.itemId === itemId
          ? {
              ...i,
              ...normalizeLine({
                qty: i.qty,
                unitPriceMillieme: i.unitPriceMillieme,
                discountPercent,
                buyPriceMillieme: i.buyPriceMillieme,
              }),
            }
          : i,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
        ),
      };
    });
  },
  updateLineUnitPrice: (itemId, unitPriceMillieme) => {
    set((state) => {
      const items = state.items.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              ...normalizeLine({
                qty: item.qty,
                unitPriceMillieme,
                discountPercent: item.discountPercent,
                buyPriceMillieme: item.buyPriceMillieme,
              }),
            }
          : item,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          Math.max(0, computeSubtotal(items) - computeMinimumSubtotal(items)),
        ),
      };
    });
  },
  setGlobalDiscount: (discountMillieme) => {
    set((state) => {
      const maximumGlobalDiscount = Math.max(
        0,
        state.subtotalMillieme() - state.minimumSubtotalMillieme(),
      );

      return {
        globalDiscountMillieme: Math.min(
          clampNonNegativeInteger(discountMillieme),
          maximumGlobalDiscount,
        ),
      };
    });
  },
  setCustomer: (id, name) => {
    set({
      customerId: id,
      customerName: name,
    });
  },
  clearCustomer: () => {
    set({
      customerId: null,
      customerName: null,
    });
  },
  setPaymentMethod: (method) => {
    set((state) => {
      const totalMillieme = state.totalMillieme();

      if (method === "cash") {
        return {
          paymentMethod: method,
          paidCashMillieme: totalMillieme,
          paidCardMillieme: 0,
        };
      }

      if (method === "card") {
        return {
          paymentMethod: method,
          paidCashMillieme: 0,
          paidCardMillieme: totalMillieme,
        };
      }

      if (method === "deferred") {
        return {
          paymentMethod: method,
          paidCashMillieme: 0,
          paidCardMillieme: 0,
        };
      }

      return {
        paymentMethod: method,
        paidCashMillieme: totalMillieme,
        paidCardMillieme: 0,
      };
    });
  },
  setPaidCashAmount: (milliemes) => {
    set({ paidCashMillieme: clampNonNegativeInteger(milliemes) });
  },
  setPaidCardAmount: (milliemes) => {
    set({ paidCardMillieme: clampNonNegativeInteger(milliemes) });
  },
  setNotes: (notes) => {
    set({ notes });
  },
  clearCart: () => {
    set({ ...initialCartState });
  },
});

export const createCartStore = () => createStore<CartState>(createCartState);

export const useCartStore = create<CartState>(createCartState);
