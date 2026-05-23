export type Category = {
  id: number;
  name_ar: string;
  created_at: string;
};

export type Item = {
  id: number;
  barcode: string | null;
  name_ar: string;
  name_en: string | null;
  category_id: number | null;
  buy_price_millieme: number;
  sell_price_millieme: number;
  color: string | null;
  size: string | null;
  unit: string;
  min_stock: number;
  current_stock: number;
  supplier_id: number | null;
  image_path: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: number;
  item_id: number;
  delta: number;
  movement_type: "sale" | "purchase" | "return" | "adjustment";
  reference_id: number | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
  reference_number: string | null;
};

export type AppErrorShape = {
  code: string;
  message_ar: string;
  message_en: string;
};

export type ItemFormValues = {
  name_ar: string;
  barcode: string;
  category_id: string;
  buy_price: string;
  sell_price: string;
  current_stock: string;
  min_stock: string;
  color: string;
  size: string;
  unit: string;
};
