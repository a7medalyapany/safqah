import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createSaleInvoice,
  listCategories,
  searchCustomers,
  searchPosItems,
} from "@/modules/pos/api";
import { POS_STALE_TIME_MS, posKeys } from "@/modules/pos/constants";

export function usePosCategories() {
  return useQuery({
    queryKey: posKeys.categories,
    queryFn: listCategories,
    staleTime: POS_STALE_TIME_MS,
  });
}

export function usePosItems(query: string, categoryId: number | null) {
  return useQuery({
    queryKey: posKeys.items(query, categoryId),
    queryFn: () =>
      searchPosItems({ query: query.trim() || null, categoryId }),
    staleTime: POS_STALE_TIME_MS,
  });
}

export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: posKeys.customers(query),
    queryFn: () => searchCustomers(query.trim() || null),
    enabled: query.trim().length > 0,
    staleTime: POS_STALE_TIME_MS,
  });
}

export function useCreateSaleInvoice() {
  return useMutation({
    mutationFn: createSaleInvoice,
  });
}
