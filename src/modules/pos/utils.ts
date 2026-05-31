import type { CartItem } from "@/store/cartSlice";
import type { CreateSaleInvoicePayload, PaymentMethod } from "@/modules/pos/types";

export function moneyToInput(milliemes: number) {
  const value = (milliemes / 1000).toFixed(3);
  return value.replace(/\.?0+$/, "");
}

export function getStockBadgeTone(stock: number) {
  if (stock <= 0) {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (stock <= 5) {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-100 text-emerald-800";
}

export function buildSalePayload(params: {
  sessionId: number;
  customerId: number | null;
  paymentMethod: PaymentMethod;
  globalDiscountMillieme: number;
  paidCashMillieme: number;
  paidCardMillieme: number;
  notes: string;
  items: CartItem[];
}): CreateSaleInvoicePayload {
  return {
    sessionId: params.sessionId,
    customerId: params.customerId,
    paymentMethod: params.paymentMethod,
    globalDiscountMillieme: params.globalDiscountMillieme,
    paidMillieme: params.paidCashMillieme + params.paidCardMillieme,
    notes: params.notes.trim() || null,
    items: params.items.map((item) => ({
      itemId: item.itemId,
      qty: item.qty,
      unitPriceMillieme: item.unitPriceMillieme,
      discountMillieme: item.discountMillieme,
    })),
  };
}
