import type { GroupBy, ReportView } from "@/modules/reports/types";
import { BalancesReportView, DailySalesReportView, ExpenseSummaryView, LowStockReportView, PaymentMethodsReportView, PeriodSalesReportView, ProfitReportView, TopItemsReportView } from "./ReportViews";

export function ReportViewScreen({
  view,
  onBack,
}: {
  view: ReportView;
  onBack: () => void;
}) {
  if (view === "daily") return <DailySalesReportView onBack={onBack} />;
  if (view === "top-items") return <TopItemsReportView onBack={onBack} />;
  if (view === "profit") return <ProfitReportView onBack={onBack} />;
  if (view === "expenses") return <ExpenseSummaryView onBack={onBack} />;
  if (view === "payments") return <PaymentMethodsReportView onBack={onBack} />;
  if (view === "customers")
    return <BalancesReportView kind="customer" onBack={onBack} />;
  if (view === "suppliers")
    return <BalancesReportView kind="supplier" onBack={onBack} />;
  if (view === "low-stock") return <LowStockReportView onBack={onBack} />;

  const initialGroup: GroupBy =
    view === "period-week" ? "week" : view === "period-month" ? "month" : "day";
  return <PeriodSalesReportView initialGroup={initialGroup} onBack={onBack} />;
}

export function toReportView(value: string | null): ReportView | null {
  if (
    value === "daily" ||
    value === "period-day" ||
    value === "period-week" ||
    value === "period-month" ||
    value === "top-items" ||
    value === "profit" ||
    value === "expenses" ||
    value === "payments" ||
    value === "customers" ||
    value === "suppliers" ||
    value === "low-stock"
  ) {
    return value;
  }

  return null;
}
