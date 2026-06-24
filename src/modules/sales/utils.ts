import type {
  InvoiceFilters,
  InvoiceItemDetail,
  InvoiceStatus,
  InvoiceSummary,
} from "@/modules/sales/types";

export function buildFilters(params: {
  dateFrom: string;
  dateTo: string;
  customerSearch: string;
  status: string;
  paymentMethod: string;
  limit: number;
  offset: number;
}): InvoiceFilters {
  return {
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
    customerSearch: params.customerSearch.trim() || null,
    status: params.status || null,
    paymentMethod: params.paymentMethod || null,
    limit: params.limit,
    offset: params.offset,
  };
}

export function getStatusTone(status: InvoiceStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "deferred") {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  if (status === "partial") {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  return "border-destructive/20 bg-destructive/10 text-destructive";
}

export function getRemainingMillieme(
  invoice: Pick<InvoiceSummary, "total_millieme" | "paid_millieme">,
) {
  return Math.max(invoice.total_millieme - invoice.paid_millieme, 0);
}

export function getReturnableQty(
  item: Pick<InvoiceItemDetail, "qty" | "returned_qty">,
) {
  return Math.max(item.qty - item.returned_qty, 0);
}

/**
 * Refund owed for returning `returnedQty` units of an invoice line, based on
 * the discounted line total so the customer gets back what they actually paid
 * (not the pre-discount unit price). Prorated for partial returns; mirrors the
 * backend's return_line_refund_millieme.
 */
export function getReturnLineRefundMillieme(
  item: Pick<InvoiceItemDetail, "qty" | "total_millieme">,
  returnedQty: number,
) {
  if (item.qty <= 0) {
    return 0;
  }
  return Math.round((item.total_millieme * returnedQty) / item.qty);
}
