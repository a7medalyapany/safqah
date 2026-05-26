export type DailySalesReport = {
  date: string;
  invoice_count: number;
  total_millieme: number;
  cash_millieme: number;
  card_millieme: number;
  deferred_millieme: number;
  discount_millieme: number;
  items_sold: number;
  avg_invoice_millieme: number;
};

export type PeriodSalesRow = {
  period_label: string;
  invoice_count: number;
  total_millieme: number;
  discount_millieme: number;
};

export type TopItemRow = {
  item_id: number;
  name_ar: string;
  total_qty_sold: number;
  total_revenue_millieme: number;
  total_cost_millieme: number;
  gross_profit_millieme: number;
};

export type LowStockItem = {
  item_id: number;
  name_ar: string;
  current_stock: number;
  min_stock: number;
  shortage: number;
  last_sale_date: string | null;
};

export type InvoiceStatus = "paid" | "deferred" | "partial" | "cancelled";
export type PaymentMethod = "cash" | "card" | "deferred" | "split";

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

export type InvoiceFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  customerSearch: string | null;
  status: string | null;
  paymentMethod: string | null;
  limit: number;
  offset: number;
};

export type DashboardData = {
  dailySales: DailySalesReport;
  topItems: TopItemRow[];
  salesByPeriod: PeriodSalesRow[];
  lowStock: LowStockItem[];
  recentInvoices: InvoiceSummary[];
};

export type DayPoint = {
  iso: string;
  label: string;
};

export type SalesTrendPoint = DayPoint & {
  total_millieme: number;
  total_egp: number;
};
