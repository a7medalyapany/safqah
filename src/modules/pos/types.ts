export type PaymentMethod = "cash" | "card" | "deferred" | "split";

export type CreateSaleInvoicePayload = {
  sessionId: number;
  customerId: number | null;
  paymentMethod: PaymentMethod;
  globalDiscountMillieme: number;
  paidMillieme: number;
  notes: string | null;
  items: Array<{
    itemId: number;
    qty: number;
    unitPriceMillieme: number;
    discountMillieme: number;
  }>;
};
