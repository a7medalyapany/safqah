import { useQuery } from "@tanstack/react-query";

import {
  getItemMovements,
  listCategories,
  listItems,
} from "@/modules/items/api";
import {
  ITEM_MOVEMENTS_STALE_TIME_MS,
  ITEMS_STALE_TIME_MS,
  itemKeys,
} from "@/modules/items/constants";

export function useItemCategories() {
  return useQuery({
    queryKey: itemKeys.categories,
    queryFn: listCategories,
    staleTime: ITEMS_STALE_TIME_MS,
  });
}

export function useItemStats() {
  return useQuery({
    queryKey: itemKeys.stats,
    queryFn: () =>
      listItems({
        search: null,
        categoryId: null,
        limit: null,
        offset: null,
      }),
    staleTime: ITEMS_STALE_TIME_MS,
  });
}

export function useItems(search: string, categoryId: number | null) {
  return useQuery({
    queryKey: itemKeys.list(search, categoryId),
    queryFn: () =>
      listItems({
        search: search.trim() || null,
        categoryId,
        limit: null,
        offset: null,
      }),
    staleTime: ITEMS_STALE_TIME_MS,
  });
}

export function useItemMovements({
  itemId,
  limit,
  enabled,
}: {
  itemId: number | undefined;
  limit: number;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: itemKeys.movements(itemId, limit),
    queryFn: () => getItemMovements({ itemId, limit }),
    enabled,
    staleTime: ITEM_MOVEMENTS_STALE_TIME_MS,
  });
}
