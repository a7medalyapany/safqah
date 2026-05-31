import type { InvoiceStatus, PaymentMethod } from "@/modules/sales/types";

export const PAGE_SIZE = 50;
export const SALES_STATS_STALE_TIME_MS = 30 * 1000;
export const SALES_LIST_STALE_TIME_MS = 15 * 1000;

export const salesKeys = {
  stats: ["invoice-stats"] as const,
  list: (
    dateFrom: string,
    dateTo: string,
    customerSearch: string,
    status: string,
    paymentMethod: string,
    visibleLimit: number,
  ) =>
    [
      "invoices",
      dateFrom,
      dateTo,
      customerSearch,
      status,
      paymentMethod,
      visibleLimit,
    ] as const,
  detail: (invoiceId: number | null) => ["invoice-detail", invoiceId] as const,
};

export const statusLabels: Record<InvoiceStatus, string> = {
  paid: "مدفوع",
  deferred: "آجل",
  partial: "جزئي",
  cancelled: "ملغي",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "كاش",
  card: "فيزا",
  deferred: "آجل",
  split: "مختلط",
};
