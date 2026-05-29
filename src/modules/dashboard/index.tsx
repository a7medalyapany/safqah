import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  ChartSkeleton,
  ErrorState,
  ListSkeleton,
} from "@/modules/dashboard/components/DashboardStates";
import { KpiCards } from "@/modules/dashboard/components/KpiCards";
import { LowStockPanel } from "@/modules/dashboard/components/LowStockPanel";
import { QuickActions } from "@/modules/dashboard/components/QuickActions";
import { RecentInvoicesPanel } from "@/modules/dashboard/components/RecentInvoicesPanel";
import { SalesTrendChart } from "@/modules/dashboard/components/SalesTrendChart";
import { TopItemsChart } from "@/modules/dashboard/components/TopItemsChart";
import type {
  DailySalesReport,
  DashboardData,
  InvoiceFilters,
  InvoiceSummary,
  LowStockItem,
  PeriodSalesRow,
  TopItemRow,
} from "@/modules/dashboard/types";
import { buildSalesTrend, lastDays, today } from "@/modules/dashboard/utils";
import { ItemFormDialog } from "@/modules/items/ItemFormDialog";
import { SectionCard } from "@/shared/components/SectionCard";
import { invoke } from "@/shared/utils/invoke";

const STALE_TIME = 2 * 60 * 1000;

export default function DashboardPage() {
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const todayValue = useMemo(() => today(), []);
  const days = useMemo(() => lastDays(7), []);
  const dateFrom = days[0]?.iso ?? todayValue;
  const dateTo = days[days.length - 1]?.iso ?? todayValue;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", todayValue, dateFrom, dateTo],
    queryFn: async (): Promise<DashboardData> => {
      const invoiceFilters: InvoiceFilters = {
        dateFrom: null,
        dateTo: null,
        customerSearch: null,
        status: null,
        paymentMethod: null,
        limit: 5,
        offset: 0,
      };

      const [dailySales, topItems, salesByPeriod, lowStock, recentInvoices] =
        await Promise.all([
          invoke<DailySalesReport>("report_daily_sales", { date: todayValue }),
          invoke<TopItemRow[]>("report_top_items", {
            dateFrom,
            dateTo,
            limit: 5,
          }),
          invoke<PeriodSalesRow[]>("report_sales_by_period", {
            dateFrom,
            dateTo,
            groupBy: "day",
          }),
          invoke<LowStockItem[]>("report_low_stock", { threshold: null }),
          invoke<InvoiceSummary[]>("list_invoices", {
            filters: invoiceFilters,
          }),
        ]);

      return {
        dailySales,
        topItems,
        salesByPeriod,
        lowStock,
        recentInvoices,
      };
    },
    staleTime: STALE_TIME,
  });

  const dashboard = dashboardQuery.data;
  const salesTrend = useMemo(
    () => buildSalesTrend(days, dashboard?.salesByPeriod ?? []),
    [dashboard?.salesByPeriod, days],
  );

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground">
          ملخص سريع للمبيعات والمخزون والفواتير.
        </p>
      </header>

      <QuickActions onAddItem={() => setIsItemDialogOpen(true)} />

      <KpiCards
        dailySales={dashboard?.dailySales}
        isLoading={dashboardQuery.isLoading}
        isError={dashboardQuery.isError}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <SectionCard title="مبيعات آخر 7 أيام" className="min-h-95">
          {dashboardQuery.isLoading ? (
            <ChartSkeleton />
          ) : dashboardQuery.isError ? (
            <ErrorState />
          ) : (
            <SalesTrendChart data={salesTrend} />
          )}
        </SectionCard>

        <SectionCard title="أكثر المنتجات مبيعاً" className="min-h-95">
          {dashboardQuery.isLoading ? (
            <ChartSkeleton />
          ) : dashboardQuery.isError ? (
            <ErrorState />
          ) : (
            <TopItemsChart data={dashboard?.topItems ?? []} />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <LowStockPanel
          items={dashboard?.lowStock ?? []}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          loadingFallback={<ListSkeleton rows={5} />}
        />

        <RecentInvoicesPanel
          invoices={dashboard?.recentInvoices ?? []}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          loadingFallback={<ListSkeleton rows={5} />}
        />
      </section>

      <ItemFormDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
      />
    </div>
  );
}
