import type { PaymentMethod, PurchaseStatus } from "@/modules/purchases/types";

export const PURCHASES_PAGE_SIZE = 50;

export const statusLabels: Record<PurchaseStatus, string> = {
  paid: "مدفوع",
  deferred: "آجل",
  partial: "جزئي",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "كاش",
  deferred: "آجل",
  partial: "جزئي",
};
