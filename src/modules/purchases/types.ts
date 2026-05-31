export type PurchaseStatus = "paid" | "deferred" | "partial";
export type PaymentMethod = "cash" | "deferred" | "partial";

export type PurchaseFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  supplierId: number | null;
  status: string | null;
  limit: number;
  offset: number;
};

export type PurchaseSummary = {
  id: number;
  invoice_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  total_millieme: number;
  paid_millieme: number;
  payment_method: string;
  status: PurchaseStatus;
  created_at: string;
};

export type PurchaseStats = {
  total_count: number;
  paid_count: number;
  deferred_count: number;
  total_purchases_millieme: number;
};

export type PurchaseItemDetail = {
  id: number;
  purchase_id: number;
  item_id: number;
  item_name_ar: string;
  qty: number;
  unit_cost_millieme: number;
  suggested_sell_price_millieme: number | null;
  total_millieme: number;
};

export type PurchaseDetail = PurchaseSummary & {
  session_id: number | null;
  subtotal_millieme: number;
  discount_millieme: number;
  notes: string | null;
  items: PurchaseItemDetail[];
};

export type DraftPurchaseItem = {
  itemId: number;
  itemName: string;
  qty: string;
  unitCost: string;
  suggestedSellPrice: string;
  currentSellPriceMillieme: number;
  lastPurchaseCostMillieme: number | null;
  lastPurchaseDate: string | null;
  isNew: boolean;
};

export type ItemPurchaseHistory = {
  item_id: number;
  name_ar: string;
  current_buy_price_millieme: number;
  current_sell_price_millieme: number;
  last_purchase_date: string | null;
  last_purchase_cost_millieme: number | null;
  last_purchase_qty: number | null;
  last_supplier_name: string | null;
  purchase_count: number;
  avg_cost_millieme: number | null;
};

export type PriceSuggestion = {
  itemId: number;
  itemName: string;
  currentSellPriceMillieme: number;
  suggestedSellPriceMillieme: number;
};
