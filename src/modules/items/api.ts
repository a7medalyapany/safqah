import type { Category, Item, StockMovement } from "@/modules/items/types";
import { invoke } from "@/shared/utils/invoke";

export function listCategories() {
  return invoke<Category[]>("list_categories");
}

export function listItems({
  search,
  categoryId,
  limit,
  offset,
}: {
  search: string | null;
  categoryId: number | null;
  limit: number | null;
  offset: number | null;
}) {
  return invoke<Item[]>("list_items", { search, categoryId, limit, offset });
}

export function getItemMovements({
  itemId,
  limit,
}: {
  itemId: number | undefined;
  limit: number;
}) {
  return invoke<StockMovement[]>("get_item_movements", { itemId, limit });
}
