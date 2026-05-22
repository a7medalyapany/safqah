import { create, type StateCreator } from "zustand";
import { createStore } from "zustand/vanilla";

import { type Item } from "@/modules/items/types";

export interface CartItem {
  itemId: number;
  barcode: string;
  nameAr: string;
  qty: number;
  unitPriceMillieme: number;
  discountMillieme: number;
  totalMillieme: number;
}

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
  totalDiscountMillieme: () => number;
  totalMillieme: () => number;
  changeMillieme: () => number;
  addItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  updateLineDiscount: (itemId: number, discountMillieme: number) => void;
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

const clampNonNegativeInteger = (value: number) => Math.max(0, toInteger(value));

const computeLineTotal = (qty: number, unitPriceMillieme: number, discountMillieme: number) =>
  Math.max(0, unitPriceMillieme * qty - discountMillieme);

const computeSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.totalMillieme, 0);

const toCartItem = (item: Item): CartItem => {
  const qty = 1;
  const discountMillieme = 0;
  const unitPriceMillieme = toInteger(item.sell_price_millieme);

  return {
    itemId: item.id,
    barcode: item.barcode ?? "",
    nameAr: item.name_ar,
    qty,
    unitPriceMillieme,
    discountMillieme,
    totalMillieme: computeLineTotal(qty, unitPriceMillieme, discountMillieme),
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
  totalDiscountMillieme: () =>
    get().items.reduce((sum, item) => sum + item.discountMillieme, 0) +
    get().globalDiscountMillieme,
  totalMillieme: () => Math.max(0, get().subtotalMillieme() - get().globalDiscountMillieme),
  changeMillieme: () =>
    get().paymentMethod === "cash"
      ? get().paidCashMillieme - get().totalMillieme()
      : 0,
  addItem: (item) => {
    set((state) => {
      const existingItem = state.items.find((cartItem) => cartItem.itemId === item.id);

      if (!existingItem) {
        const items = [...state.items, toCartItem(item)];
        return {
          items,
          globalDiscountMillieme: Math.min(
            state.globalDiscountMillieme,
            computeSubtotal(items),
          ),
        };
      }

      const qty = existingItem.qty + 1;
      const items = state.items.map((cartItem) =>
        cartItem.itemId === item.id
          ? {
              ...cartItem,
              qty,
              totalMillieme: computeLineTotal(
                qty,
                cartItem.unitPriceMillieme,
                cartItem.discountMillieme,
              ),
            }
          : cartItem,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          computeSubtotal(items),
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
          computeSubtotal(items),
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
              qty: nextQty,
              totalMillieme: computeLineTotal(
                nextQty,
                item.unitPriceMillieme,
                item.discountMillieme,
              ),
            }
          : item,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          computeSubtotal(items),
        ),
      };
    });
  },
  updateLineDiscount: (itemId, discountMillieme) => {
    set((state) => {
      const items = state.items.map((item) =>
        item.itemId === itemId
          ? (() => {
              const maxDiscountMillieme = item.qty * item.unitPriceMillieme;
              const nextDiscountMillieme = Math.min(
                clampNonNegativeInteger(discountMillieme),
                maxDiscountMillieme,
              );

              return {
                ...item,
                discountMillieme: nextDiscountMillieme,
                totalMillieme: computeLineTotal(
                  item.qty,
                  item.unitPriceMillieme,
                  nextDiscountMillieme,
                ),
              };
            })()
          : item,
      );

      return {
        items,
        globalDiscountMillieme: Math.min(
          state.globalDiscountMillieme,
          computeSubtotal(items),
        ),
      };
    });
  },
  setGlobalDiscount: (discountMillieme) => {
    set((state) => ({
      globalDiscountMillieme: Math.min(
        clampNonNegativeInteger(discountMillieme),
        state.subtotalMillieme(),
      ),
    }));
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
