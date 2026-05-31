export type TabId = "receipts" | "payments" | "deferred" | "expenses" | "summary";

export type DeferredInvoiceSummary = {
  invoice_id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  total_millieme: number;
  paid_millieme: number;
  remaining_millieme: number;
  status: string;
  created_at: string;
  days_outstanding: number;
};

export type PaymentMethod = "cash" | "card" | "bank";
export type DateFilter = "today" | "week" | "month" | "all";

export type PaymentWithEntity = {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  amount_millieme: number;
  direction: string;
  method: string;
  reference_invoice_id: number | null;
  notes: string | null;
  session_id: number | null;
  created_at: string;
};

export type ExpenseCategory = {
  id: number;
  name_ar: string;
  created_at: string;
};

export type ExpenseWithCategory = {
  id: number;
  amount_millieme: number;
  category_id: number | null;
  category_name_ar: string | null;
  description: string | null;
  session_id: number | null;
  created_by: number;
  created_at: string;
};

export type CashSummary = {
  total_sales_cash_millieme: number;
  total_expenses_millieme: number;
  total_payments_out_millieme: number;
  total_payments_in_millieme: number;
  net_cash_millieme: number;
};
