export type InvoiceStatus = "paid" | "deferred" | "partial" | "cancelled";
export type PaymentMethod = "cash" | "card" | "deferred" | "split";
export type RefundMethod = "cash" | "credit";

export type InvoiceFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  customerSearch: string | null;
  status: string | null;
  paymentMethod: string | null;
  limit: number;
  offset: number;
};

export type InvoiceSummary = {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string | null;
  total_millieme: number;
  paid_millieme: number;
  payment_method: PaymentMethod;
  status: InvoiceStatus;
  created_at: string;
};

export type InvoiceStats = {
  total_count: number;
  paid_count: number;
  deferred_count: number;
  total_sales_millieme: number;
};

export type InvoiceItemDetail = {
  id: number;
  invoice_id: number;
  item_id: number;
  item_name_ar: string;
  qty: number;
  returned_qty: number;
  unit_price_millieme: number;
  discount_millieme: number;
  total_millieme: number;
};

export type InvoiceDetail = InvoiceSummary & {
  session_id: number;
  cashier_id: number;
  subtotal_millieme: number;
  discount_millieme: number;
  tax_millieme: number;
  notes: string | null;
  items: InvoiceItemDetail[];
};

export type CreateReturnPayload = {
  originalInvoiceId: number;
  sessionId: number;
  items: {
    invoiceItemId: number;
    itemId: number;
    qty: number;
  }[];
  refundMethod: RefundMethod;
  notes: string | null;
};

export type SaleReturn = {
  id: number;
  return_number: string;
  original_invoice_id: number;
  session_id: number;
  total_millieme: number;
  refund_method: RefundMethod;
  status: string;
  notes: string | null;
  created_at: string;
};

export type ShopInfo = {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
};

export type InvoicePrintItem = {
  itemNameAr: string;
  qty: number;
  unitPriceMillieme: number;
  discountMillieme: number;
  totalMillieme: number;
};

export type InvoicePrintData = {
  invoiceNumber: string;
  customerName: string | null;
  cashierName: string | null;
  subtotalMillieme: number;
  discountMillieme: number;
  taxMillieme: number;
  totalMillieme: number;
  paidMillieme: number;
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string;
  items: InvoicePrintItem[];
  shop: ShopInfo;
  customerBalanceMillieme: number | null;
};
