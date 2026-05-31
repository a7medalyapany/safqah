export type ReportView =
  | "daily"
  | "period-day"
  | "period-week"
  | "period-month"
  | "top-items"
  | "profit"
  | "expenses"
  | "payments"
  | "customers"
  | "suppliers"
  | "low-stock";

export type GroupBy = "day" | "week" | "month";
export type BalanceKind = "customer" | "supplier";

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

export type ProfitReport = {
  gross_revenue_millieme: number;
  total_discount_millieme: number;
  net_revenue_millieme: number;
  cost_of_goods_millieme: number;
  gross_profit_millieme: number;
  total_expenses_millieme: number;
  net_profit_millieme: number;
  profit_margin_percent: number;
};

export type PaymentMethodRow = {
  method: string;
  invoice_count: number;
  total_millieme: number;
  percentage: number;
};

export type BalanceRow = {
  customer_id?: number;
  supplier_id?: number;
  name: string;
  phone: string | null;
  balance_millieme: number;
  deferred_invoice_count: number;
  oldest_invoice_date: string | null;
};

export type LowStockItem = {
  item_id: number;
  name_ar: string;
  current_stock: number;
  min_stock: number;
  shortage: number;
  last_sale_date: string | null;
};

export type ExpenseWithCategory = {
  id: number;
  amount_millieme: number;
  category_id: number | null;
  category_name_ar: string | null;
  description: string | null;
  created_at: string;
};
