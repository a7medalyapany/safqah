import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createReturn,
  getInvoiceDetail,
  getInvoiceStats,
  listInvoices,
} from "@/modules/sales/api";
import {
  SALES_LIST_STALE_TIME_MS,
  SALES_STATS_STALE_TIME_MS,
  salesKeys,
} from "@/modules/sales/constants";
import type { CreateReturnPayload } from "@/modules/sales/types";
import { buildFilters } from "@/modules/sales/utils";

export function useInvoiceStats() {
  return useQuery({
    queryKey: salesKeys.stats,
    queryFn: getInvoiceStats,
    staleTime: SALES_STATS_STALE_TIME_MS,
  });
}

export function useInvoices(params: {
  dateFrom: string;
  dateTo: string;
  customerSearch: string;
  status: string;
  paymentMethod: string;
  visibleLimit: number;
}) {
  return useQuery({
    queryKey: salesKeys.list(
      params.dateFrom,
      params.dateTo,
      params.customerSearch,
      params.status,
      params.paymentMethod,
      params.visibleLimit,
    ),
    queryFn: () =>
      listInvoices(
        buildFilters({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          customerSearch: params.customerSearch,
          status: params.status,
          paymentMethod: params.paymentMethod,
          limit: params.visibleLimit,
          offset: 0,
        }),
      ),
    staleTime: SALES_LIST_STALE_TIME_MS,
  });
}

export function useInvoiceDetail(invoiceId: number | null) {
  return useQuery({
    queryKey: salesKeys.detail(invoiceId),
    queryFn: () => getInvoiceDetail(invoiceId),
    enabled: invoiceId !== null,
  });
}

export function useCreateReturnMutation(invoiceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateReturnPayload) => createReturn(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: salesKeys.detail(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: salesKeys.stats }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
      ]);
    },
  });
}
