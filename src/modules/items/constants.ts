import type { StockMovement } from "@/modules/items/types";

export const ITEMS_STALE_TIME_MS = 30 * 1000;
export const ITEM_MOVEMENTS_STALE_TIME_MS = 15 * 1000;
export const MOVEMENTS_PAGE_SIZE = 20;

export const itemKeys = {
  categories: ["categories"] as const,
  stats: ["items-stats"] as const,
  list: (search: string, categoryId: number | null) =>
    ["items", search, categoryId] as const,
  movements: (itemId: number | undefined, limit: number) =>
    ["item-movements", itemId, limit] as const,
};

export const movementTypeLabels: Record<StockMovement["movement_type"], string> =
  {
    sale: "بيع",
    purchase: "شراء",
    return: "مرتجع",
    adjustment: "تسوية جرد",
  };
