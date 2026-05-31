import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, FileText, PackageSearch, Receipt, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { groupLabels, paymentMethodLabels } from "@/modules/reports/constants";
import type { BalanceKind, BalanceRow, DailySalesReport, ExpenseWithCategory, GroupBy, LowStockItem, PaymentMethodRow, PeriodSalesRow, ProfitReport, TopItemRow } from "@/modules/reports/types";
import { egpValue, missingValue, monthStart, printTable, today } from "@/modules/reports/utils";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP } from "@/shared/utils/money";
import { BalancePaymentDialog } from "./BalancePaymentDialog";
import { BarChartBox, ChartCard, DataTable, DateRangeFields, FilterField, FilterPanel, HorizontalBarChartBox, KpiCard, PieChartBox, ReportActions, ReportShell, TableCell } from "./ReportPrimitives";

export function DailySalesReportView({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState(today());
  const [submittedDate, setSubmittedDate] = useState(date);
  const tableRef = useRef<HTMLTableElement>(null);

  const reportQuery = useQuery({
    queryKey: ["report-daily-sales", submittedDate],
    queryFn: () =>
      invoke<DailySalesReport>("report_daily_sales", {
        date: submittedDate || null,
      }),
  });

  const report = reportQuery.data;
  const reportRows = report
    ? [
        [
          report.date,
          String(report.invoice_count),
          formatEGP(report.total_millieme),
          formatEGP(report.cash_millieme),
          formatEGP(report.card_millieme),
          formatEGP(report.deferred_millieme),
        ],
      ]
    : [];

  return (
    <ReportShell
      title="تقرير المبيعات اليومية"
      description="مؤشرات اليوم حسب عدد الفواتير وطريقة الدفع."
      onBack={onBack}
    >
      <FilterPanel
        onSubmit={() => setSubmittedDate(date)}
        isLoading={reportQuery.isFetching}
      >
        <FilterField label="التاريخ">
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FilterField>
      </FilterPanel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          title="عدد الفواتير"
          value={report?.invoice_count ?? 0}
          icon={<FileText />}
        />
        <KpiCard
          title="إجمالي المبيعات"
          value={formatEGP(report?.total_millieme ?? 0)}
          icon={<Banknote />}
        />
        <KpiCard
          title="نقدي"
          value={formatEGP(report?.cash_millieme ?? 0)}
          icon={<Banknote />}
        />
        <KpiCard
          title="فيزا"
          value={formatEGP(report?.card_millieme ?? 0)}
          icon={<CreditCard />}
        />
        <KpiCard
          title="آجل"
          value={formatEGP(report?.deferred_millieme ?? 0)}
          icon={<WalletCards />}
        />
        <KpiCard
          title="متوسط الفاتورة"
          value={formatEGP(report?.avg_invoice_millieme ?? 0)}
          icon={<Receipt />}
        />
      </section>

      <DataTable
        ref={tableRef}
        columns={["التاريخ", "عدد الفواتير", "الإجمالي", "نقدي", "فيزا", "آجل"]}
        empty={!report}
      >
        {reportRows.map((row) => (
          <tr key={row[0]} className="border-t">
            {row.map((cell, index) => (
              <TableCell key={`${cell}-${index}`}>{cell}</TableCell>
            ))}
          </tr>
        ))}
      </DataTable>

      <ReportActions
        disabled={!report}
        onExportCsv={() =>
          exportToCsv(
            `تقرير_مبيعات_${submittedDate}.csv`,
            ["التاريخ", "عدد الفواتير", "الإجمالي", "نقدي", "فيزا", "آجل"],
            reportRows,
          )
        }
        onPrint={() => printTable("تقرير المبيعات اليومية", tableRef.current)}
      />
    </ReportShell>
  );
}

export function PeriodSalesReportView({
  initialGroup,
  onBack,
}: {
  initialGroup: GroupBy;
  onBack: () => void;
}) {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroup);
  const [params, setParams] = useState({ dateFrom, dateTo, groupBy });
  const tableRef = useRef<HTMLTableElement>(null);

  const reportQuery = useQuery({
    queryKey: ["report-sales-by-period", params],
    queryFn: () =>
      invoke<PeriodSalesRow[]>("report_sales_by_period", {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        groupBy: params.groupBy,
      }),
  });

  const rows = reportQuery.data ?? [];
  const chartData = rows.map((row) => ({
    ...row,
    total_egp: egpValue(row.total_millieme),
  }));
  const csvRows = rows.map((row) => [
    row.period_label,
    String(row.invoice_count),
    formatEGP(row.total_millieme),
    formatEGP(row.discount_millieme),
  ]);

  return (
    <ReportShell
      title="تقرير المبيعات حسب الفترة"
      description="رسم بياني وجدول للفواتير والإجمالي والخصم."
      onBack={onBack}
    >
      <FilterPanel
        onSubmit={() => setParams({ dateFrom, dateTo, groupBy })}
        isLoading={reportQuery.isFetching}
      >
        <DateRangeFields
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
        <FilterField label="التجميع">
          <div className="flex rounded-lg border bg-background p-1">
            {(["day", "week", "month"] as GroupBy[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGroupBy(value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                  groupBy === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {groupLabels[value]}
              </button>
            ))}
          </div>
        </FilterField>
      </FilterPanel>

      <ChartCard title="اتجاه المبيعات">
        <BarChartBox data={chartData} xKey="period_label" yKey="total_egp" />
      </ChartCard>

      <DataTable
        ref={tableRef}
        columns={["الفترة", "عدد الفواتير", "الإجمالي", "الخصم"]}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={row.period_label} className="border-t">
            <TableCell>{row.period_label}</TableCell>
            <TableCell>{row.invoice_count}</TableCell>
            <TableCell>{formatEGP(row.total_millieme)}</TableCell>
            <TableCell>{formatEGP(row.discount_millieme)}</TableCell>
          </tr>
        ))}
      </DataTable>

      <ReportActions
        disabled={rows.length === 0}
        onExportCsv={() =>
          exportToCsv(
            `مبيعات_${groupLabels[params.groupBy]}_${params.dateFrom}_${params.dateTo}.csv`,
            ["الفترة", "عدد الفواتير", "الإجمالي", "الخصم"],
            csvRows,
          )
        }
        onPrint={() =>
          printTable("تقرير المبيعات حسب الفترة", tableRef.current)
        }
      />
    </ReportShell>
  );
}

export function TopItemsReportView({ onBack }: { onBack: () => void }) {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [limit, setLimit] = useState(10);
  const [params, setParams] = useState({ dateFrom, dateTo, limit });
  const tableRef = useRef<HTMLTableElement>(null);

  const reportQuery = useQuery({
    queryKey: ["report-top-items", params],
    queryFn: () =>
      invoke<TopItemRow[]>("report_top_items", {
        dateFrom: params.dateFrom || null,
        dateTo: params.dateTo || null,
        limit: params.limit,
      }),
  });

  const rows = reportQuery.data ?? [];
  const csvRows = rows.map((row) => [
    row.name_ar,
    String(row.total_qty_sold),
    formatEGP(row.total_revenue_millieme),
    formatEGP(row.total_cost_millieme),
    formatEGP(row.gross_profit_millieme),
  ]);

  return (
    <ReportShell
      title="أفضل المنتجات مبيعاً"
      description="ترتيب الأصناف حسب الكمية المباعة مع الإيراد والتكلفة."
      onBack={onBack}
    >
      <FilterPanel
        onSubmit={() => setParams({ dateFrom, dateTo, limit })}
        isLoading={reportQuery.isFetching}
      >
        <DateRangeFields
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
        <FilterField label="عدد النتائج">
          <select
            dir="rtl"
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </FilterField>
      </FilterPanel>

      <ChartCard title="الكميات المباعة">
        <HorizontalBarChartBox data={rows} />
      </ChartCard>

      <DataTable
        ref={tableRef}
        columns={["الصنف", "الكمية المباعة", "الإيراد", "التكلفة", "الربح"]}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={row.item_id} className="border-t">
            <TableCell className="font-medium text-foreground">
              {row.name_ar}
            </TableCell>
            <TableCell>{row.total_qty_sold}</TableCell>
            <TableCell>{formatEGP(row.total_revenue_millieme)}</TableCell>
            <TableCell>{formatEGP(row.total_cost_millieme)}</TableCell>
            <TableCell
              className={
                row.gross_profit_millieme >= 0
                  ? "text-emerald-600"
                  : "text-destructive"
              }
            >
              {formatEGP(row.gross_profit_millieme)}
            </TableCell>
          </tr>
        ))}
      </DataTable>

      <ReportActions
        disabled={rows.length === 0}
        onExportCsv={() =>
          exportToCsv(
            `أفضل_الأصناف_${params.dateFrom}_${params.dateTo}.csv`,
            ["الصنف", "الكمية المباعة", "الإيراد", "التكلفة", "الربح"],
            csvRows,
          )
        }
        onPrint={() => printTable("أفضل المنتجات مبيعاً", tableRef.current)}
      />
    </ReportShell>
  );
}

export function ProfitReportView({ onBack }: { onBack: () => void }) {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [params, setParams] = useState({ dateFrom, dateTo });
  const tableRef = useRef<HTMLTableElement>(null);

  const reportQuery = useQuery({
    queryKey: ["report-profit-analysis", params],
    queryFn: () =>
      invoke<ProfitReport>("report_profit_analysis", {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
  });

  const report = reportQuery.data;
  const pieData = report
    ? [
        { name: "صافي الإيراد", value: egpValue(report.net_revenue_millieme) },
        {
          name: "تكلفة البضاعة",
          value: egpValue(report.cost_of_goods_millieme),
        },
        { name: "المصروفات", value: egpValue(report.total_expenses_millieme) },
      ]
    : [];
  const csvRows = report
    ? [
        ["الإيراد الإجمالي", formatEGP(report.gross_revenue_millieme)],
        ["إجمالي الخصم", formatEGP(report.total_discount_millieme)],
        ["صافي الإيراد", formatEGP(report.net_revenue_millieme)],
        ["تكلفة البضاعة", formatEGP(report.cost_of_goods_millieme)],
        ["الربح الإجمالي", formatEGP(report.gross_profit_millieme)],
        ["إجمالي المصروفات", formatEGP(report.total_expenses_millieme)],
        ["صافي الربح", formatEGP(report.net_profit_millieme)],
        ["هامش الربح", `${report.profit_margin_percent.toFixed(2)}%`],
      ]
    : [];

  return (
    <ReportShell
      title="تحليل الأرباح"
      description="تحليل الربحية بناءً على الإيراد والتكلفة والمصروفات."
      onBack={onBack}
    >
      <FilterPanel
        onSubmit={() => setParams({ dateFrom, dateTo })}
        isLoading={reportQuery.isFetching}
      >
        <DateRangeFields
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
      </FilterPanel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="الإيراد الإجمالي"
          value={formatEGP(report?.gross_revenue_millieme ?? 0)}
          icon={<Banknote />}
        />
        <KpiCard
          title="صافي الإيراد"
          value={formatEGP(report?.net_revenue_millieme ?? 0)}
          icon={<Receipt />}
        />
        <KpiCard
          title="تكلفة البضاعة"
          value={formatEGP(report?.cost_of_goods_millieme ?? 0)}
          icon={<PackageSearch />}
        />
        <KpiCard
          title="إجمالي المصروفات"
          value={formatEGP(report?.total_expenses_millieme ?? 0)}
          icon={<WalletCards />}
        />
      </section>

      <Card>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col justify-center rounded-2xl bg-muted/30 p-6">
            <p className="text-sm text-muted-foreground">صافي الربح</p>
            <p
              className={cn(
                "mt-2 text-4xl font-bold",
                (report?.net_profit_millieme ?? 0) >= 0
                  ? "text-emerald-600"
                  : "text-destructive",
              )}
            >
              {formatEGP(report?.net_profit_millieme ?? 0)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              هامش الربح: {(report?.profit_margin_percent ?? 0).toFixed(2)}%
            </p>
          </div>
          <PieChartBox data={pieData} />
        </CardContent>
      </Card>

      <DataTable ref={tableRef} columns={["البند", "القيمة"]} empty={!report}>
        {csvRows.map((row) => (
          <tr key={row[0]} className="border-t">
            <TableCell>{row[0]}</TableCell>
            <TableCell>{row[1]}</TableCell>
          </tr>
        ))}
      </DataTable>

      <ReportActions
        disabled={!report}
        onExportCsv={() =>
          exportToCsv(
            `تحليل_الأرباح_${params.dateFrom}_${params.dateTo}.csv`,
            ["البند", "القيمة"],
            csvRows,
          )
        }
        onPrint={() => printTable("تحليل الأرباح", tableRef.current)}
      />
    </ReportShell>
  );
}

export function ExpenseSummaryView({ onBack }: { onBack: () => void }) {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [params, setParams] = useState({ dateFrom, dateTo });
  const tableRef = useRef<HTMLTableElement>(null);

  const expensesQuery = useQuery({
    queryKey: ["report-expense-summary", params],
    queryFn: () =>
      invoke<ExpenseWithCategory[]>("list_expenses", {
        dateFrom: params.dateFrom || null,
        dateTo: params.dateTo || null,
        categoryId: null,
      }),
  });

  const rows = expensesQuery.data ?? [];
  const summary = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const key = row.category_name_ar || "غير مصنف";
      grouped.set(key, (grouped.get(key) ?? 0) + row.amount_millieme);
    }
    return Array.from(grouped.entries())
      .map(([category, amount_millieme]) => ({ category, amount_millieme }))
      .sort((a, b) => b.amount_millieme - a.amount_millieme);
  }, [rows]);
  const total = summary.reduce((sum, row) => sum + row.amount_millieme, 0);
  const csvRows = summary.map((row) => [
    row.category,
    formatEGP(row.amount_millieme),
  ]);

  return (
    <ReportShell
      title="ملخص المصروفات"
      description="إجمالي المصروفات وتوزيعها حسب التصنيف."
      onBack={onBack}
    >
      <FilterPanel
        onSubmit={() => setParams({ dateFrom, dateTo })}
        isLoading={expensesQuery.isFetching}
      >
        <DateRangeFields
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
      </FilterPanel>

      <KpiCard
        title="إجمالي المصروفات"
        value={formatEGP(total)}
        icon={<Receipt />}
      />
      <ChartCard title="توزيع المصروفات">
        <PieChartBox
          data={summary.map((row) => ({
            name: row.category,
            value: egpValue(row.amount_millieme),
          }))}
        />
      </ChartCard>
      <DataTable
        ref={tableRef}
        columns={["التصنيف", "الإجمالي"]}
        empty={summary.length === 0}
      >
        {summary.map((row) => (
          <tr key={row.category} className="border-t">
            <TableCell>{row.category}</TableCell>
            <TableCell>{formatEGP(row.amount_millieme)}</TableCell>
          </tr>
        ))}
      </DataTable>
      <ReportActions
        disabled={summary.length === 0}
        onExportCsv={() =>
          exportToCsv(
            `ملخص_المصروفات_${params.dateFrom}_${params.dateTo}.csv`,
            ["التصنيف", "الإجمالي"],
            csvRows,
          )
        }
        onPrint={() => printTable("ملخص المصروفات", tableRef.current)}
      />
    </ReportShell>
  );
}

export function PaymentMethodsReportView({ onBack }: { onBack: () => void }) {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [params, setParams] = useState({ dateFrom, dateTo });
  const tableRef = useRef<HTMLTableElement>(null);

  const reportQuery = useQuery({
    queryKey: ["report-payment-methods", params],
    queryFn: () =>
      invoke<PaymentMethodRow[]>("report_payment_methods", {
        dateFrom: params.dateFrom || null,
        dateTo: params.dateTo || null,
      }),
  });

  const rows = reportQuery.data ?? [];
  const csvRows = rows.map((row) => [
    paymentMethodLabels[row.method] ?? row.method,
    String(row.invoice_count),
    formatEGP(row.total_millieme),
    `${row.percentage.toFixed(2)}%`,
  ]);

  return (
    <ReportShell
      title="تقرير طرق الدفع"
      description="نسبة وقيمة المبيعات حسب طريقة الدفع."
      onBack={onBack}
    >
      <FilterPanel
        onSubmit={() => setParams({ dateFrom, dateTo })}
        isLoading={reportQuery.isFetching}
      >
        <DateRangeFields
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
      </FilterPanel>

      <ChartCard title="توزيع طرق الدفع">
        <PieChartBox
          data={rows.map((row) => ({
            name: paymentMethodLabels[row.method] ?? row.method,
            value: egpValue(row.total_millieme),
          }))}
        />
      </ChartCard>

      <DataTable
        ref={tableRef}
        columns={["طريقة الدفع", "عدد الفواتير", "الإجمالي", "النسبة"]}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={row.method} className="border-t">
            <TableCell>
              {paymentMethodLabels[row.method] ?? row.method}
            </TableCell>
            <TableCell>{row.invoice_count}</TableCell>
            <TableCell>{formatEGP(row.total_millieme)}</TableCell>
            <TableCell>{row.percentage.toFixed(2)}%</TableCell>
          </tr>
        ))}
      </DataTable>
      <ReportActions
        disabled={rows.length === 0}
        onExportCsv={() =>
          exportToCsv(
            `طرق_الدفع_${params.dateFrom}_${params.dateTo}.csv`,
            ["طريقة الدفع", "عدد الفواتير", "الإجمالي", "النسبة"],
            csvRows,
          )
        }
        onPrint={() => printTable("تقرير طرق الدفع", tableRef.current)}
      />
    </ReportShell>
  );
}

export function BalancesReportView({
  kind,
  onBack,
}: {
  kind: BalanceKind;
  onBack: () => void;
}) {
  const [selectedRow, setSelectedRow] = useState<BalanceRow | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const title =
    kind === "customer" ? "تقرير ديون العملاء" : "تقرير ديون الموردين";
  const command =
    kind === "customer"
      ? "report_customer_balances"
      : "report_supplier_balances";

  const reportQuery = useQuery({
    queryKey: ["report-balances", kind],
    queryFn: () => invoke<BalanceRow[]>(command),
  });

  const rows = reportQuery.data ?? [];
  const total = rows.reduce((sum, row) => sum + row.balance_millieme, 0);
  const csvRows = rows.map((row) => [
    row.name,
    missingValue(row.phone),
    formatEGP(row.balance_millieme),
    String(row.deferred_invoice_count),
  ]);

  return (
    <ReportShell
      title={title}
      description="الأرصدة الحالية التي تحتاج متابعة أو تسجيل دفعة."
      onBack={onBack}
    >
      <DataTable
        ref={tableRef}
        columns={[
          "الاسم",
          "الهاتف",
          "المديونية",
          "عدد الفواتير",
          "أقدم فاتورة",
          "الإجراءات",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={row.customer_id ?? row.supplier_id} className="border-t">
            <TableCell className="font-medium text-foreground">
              {row.name}
            </TableCell>
            <TableCell>{row.phone || "—"}</TableCell>
            <TableCell>{formatEGP(row.balance_millieme)}</TableCell>
            <TableCell>{row.deferred_invoice_count}</TableCell>
            <TableCell>{row.oldest_invoice_date || "—"}</TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedRow(row)}
              >
                تسجيل دفعة
              </Button>
            </TableCell>
          </tr>
        ))}
        {rows.length > 0 ? (
          <tr className="border-t bg-muted/40 font-semibold">
            <TableCell colSpan={6}>
              إجمالي المديونيات: {formatEGP(total)}
            </TableCell>
          </tr>
        ) : null}
      </DataTable>

      <ReportActions
        disabled={rows.length === 0}
        onExportCsv={() =>
          exportToCsv(
            `${kind === "customer" ? "مديونيات_العملاء" : "مديونيات_الموردين"}_${today()}.csv`,
            [
              kind === "customer" ? "العميل" : "المورد",
              "الهاتف",
              "المديونية",
              "عدد الفواتير",
            ],
            csvRows,
          )
        }
        onPrint={() => printTable(title, tableRef.current)}
      />
      <BalancePaymentDialog
        kind={kind}
        row={selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null);
        }}
      />
    </ReportShell>
  );
}

export function LowStockReportView({ onBack }: { onBack: () => void }) {
  const tableRef = useRef<HTMLTableElement>(null);
  const reportQuery = useQuery({
    queryKey: ["report-low-stock"],
    queryFn: () =>
      invoke<LowStockItem[]>("report_low_stock", { threshold: null }),
  });

  const rows = reportQuery.data ?? [];
  const csvRows = rows.map((row) => [
    row.name_ar,
    String(row.current_stock),
    String(row.min_stock),
    String(row.shortage),
  ]);

  return (
    <ReportShell
      title="تقرير المخزون المنخفض"
      description="الأصناف التي وصلت أو اقتربت من الحد الأدنى للمخزون."
      onBack={onBack}
    >
      <DataTable
        ref={tableRef}
        columns={[
          "الصنف",
          "المخزون الحالي",
          "الحد الأدنى",
          "النقص",
          "آخر بيع",
          "الإجراءات",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={row.item_id} className="border-t">
            <TableCell className="font-medium text-foreground">
              {row.name_ar}
            </TableCell>
            <TableCell>{row.current_stock}</TableCell>
            <TableCell>{row.min_stock}</TableCell>
            <TableCell>
              <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                {row.shortage}
              </span>
            </TableCell>
            <TableCell>{row.last_sale_date || "—"}</TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toast.info(
                    "إضافة شراء مبدئية لهذا الصنف تحتاج تصدير PurchaseFormDialog من شاشة المشتريات",
                  )
                }
              >
                إضافة شراء
              </Button>
            </TableCell>
          </tr>
        ))}
      </DataTable>
      <ReportActions
        disabled={rows.length === 0}
        onExportCsv={() =>
          exportToCsv(
            `مخزون_منخفض_${today()}.csv`,
            ["الصنف", "المخزون الحالي", "الحد الأدنى", "النقص"],
            csvRows,
          )
        }
        onPrint={() => printTable("تقرير المخزون المنخفض", tableRef.current)}
      />
    </ReportShell>
  );
}
