import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  LineChart as LineChartIcon,
  PackageSearch,
  Printer,
  Receipt,
  TrendingUp,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import { forwardRef, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { printReport } from "@/shared/utils/printReport";
import { SectionCard } from "@/shared/components/SectionCard";
import { invoke } from "@/shared/utils/invoke";
import { useSessionStore } from "@/store/sessionSlice";

type ReportView =
  | "daily"
  | "period-day"
  | "period-week"
  | "period-month"
  | "top-items"
  | "profit"
  | "expenses"
  | "payments"
  | "customers"
  | "suppliers"
  | "low-stock";

type GroupBy = "day" | "week" | "month";
type BalanceKind = "customer" | "supplier";

type DailySalesReport = {
  date: string;
  invoice_count: number;
  total_millieme: number;
  cash_millieme: number;
  card_millieme: number;
  deferred_millieme: number;
  discount_millieme: number;
  items_sold: number;
  avg_invoice_millieme: number;
};

type PeriodSalesRow = {
  period_label: string;
  invoice_count: number;
  total_millieme: number;
  discount_millieme: number;
};

type TopItemRow = {
  item_id: number;
  name_ar: string;
  total_qty_sold: number;
  total_revenue_millieme: number;
  total_cost_millieme: number;
  gross_profit_millieme: number;
};

type ProfitReport = {
  gross_revenue_millieme: number;
  total_discount_millieme: number;
  net_revenue_millieme: number;
  cost_of_goods_millieme: number;
  gross_profit_millieme: number;
  total_expenses_millieme: number;
  net_profit_millieme: number;
  profit_margin_percent: number;
};

type PaymentMethodRow = {
  method: string;
  invoice_count: number;
  total_millieme: number;
  percentage: number;
};

type BalanceRow = {
  customer_id?: number;
  supplier_id?: number;
  name: string;
  phone: string | null;
  balance_millieme: number;
  deferred_invoice_count: number;
  oldest_invoice_date: string | null;
};

type LowStockItem = {
  item_id: number;
  name_ar: string;
  current_stock: number;
  min_stock: number;
  shortage: number;
  last_sale_date: string | null;
};

type ExpenseWithCategory = {
  id: number;
  amount_millieme: number;
  category_id: number | null;
  category_name_ar: string | null;
  description: string | null;
  created_at: string;
};

const chartColors = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#7c3aed"];

const paymentMethodLabels: Record<string, string> = {
  cash: "كاش",
  card: "فيزا",
  deferred: "آجل",
  split: "مختلط",
};

const groupLabels: Record<GroupBy, string> = {
  day: "يومي",
  week: "أسبوعي",
  month: "شهري",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function egpValue(millieme: number) {
  return Math.round((millieme / 1000) * 100) / 100;
}

function printTable(title: string, table: HTMLTableElement | null) {
  if (!table) {
    toast.error("لا يوجد جدول متاح للطباعة");
    return;
  }

  printReport(title, table.outerHTML);
}

function missingValue(value: string | null | undefined) {
  return value || "—";
}

const reportSections: {
  title: string;
  cards: {
    view: ReportView;
    title: string;
    subtitle: string;
    icon: ReactNode;
  }[];
}[] = [
  {
    title: "تقارير المبيعات",
    cards: [
      {
        view: "daily",
        title: "تقرير المبيعات اليومية",
        subtitle: "ملخص فواتير ومبالغ اليوم حسب طريقة الدفع.",
        icon: <CalendarDays />,
      },
      {
        view: "period-week",
        title: "تقرير المبيعات الأسبوعية",
        subtitle: "اتجاه المبيعات مجمّعاً حسب الأسبوع.",
        icon: <LineChartIcon />,
      },
      {
        view: "period-month",
        title: "تقرير المبيعات الشهرية",
        subtitle: "مقارنة المبيعات والخصومات على مستوى الشهر.",
        icon: <BarChart3 />,
      },
      {
        view: "top-items",
        title: "أفضل المنتجات مبيعاً",
        subtitle: "أعلى الأصناف حسب الكمية والإيراد والربح.",
        icon: <TrendingUp />,
      },
    ],
  },
  {
    title: "تقارير مالية",
    cards: [
      {
        view: "profit",
        title: "تحليل الأرباح",
        subtitle: "صافي الربح والهامش بعد التكلفة والمصروفات.",
        icon: <WalletCards />,
      },
      {
        view: "expenses",
        title: "ملخص المصروفات",
        subtitle: "إجمالي المصروفات وتوزيعها حسب التصنيف.",
        icon: <Receipt />,
      },
      {
        view: "payments",
        title: "تقرير طرق الدفع",
        subtitle: "نسب التحصيل حسب كاش وفيزا وآجل.",
        icon: <CreditCard />,
      },
    ],
  },
  {
    title: "تقارير العملاء والموردين",
    cards: [
      {
        view: "customers",
        title: "تقرير ديون العملاء",
        subtitle: "الأرصدة المستحقة وعدد الفواتير الآجلة.",
        icon: <Users />,
      },
      {
        view: "suppliers",
        title: "تقرير ديون الموردين",
        subtitle: "مستحقات الموردين الحالية وأقدم فاتورة.",
        icon: <Truck />,
      },
    ],
  },
  {
    title: "تقارير المخزون",
    cards: [
      {
        view: "low-stock",
        title: "تقرير المخزون المنخفض",
        subtitle: "الأصناف تحت الحد الأدنى وحجم النقص.",
        icon: <PackageSearch />,
      },
    ],
  },
];

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryView = toReportView(searchParams.get("view"));
  const [activeView, setActiveView] = useState<ReportView | null>(queryView);

  const handleSelectView = (view: ReportView) => {
    setActiveView(view);
    setSearchParams({ view });
  };

  const handleBack = () => {
    setActiveView(null);
    setSearchParams({});
  };

  if (activeView) {
    return <ReportViewScreen view={activeView} onBack={handleBack} />;
  }

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">التقارير</h1>
        <p className="text-sm text-muted-foreground">
          مركز تقارير المبيعات والمالية والعملاء والمخزون.
        </p>
      </header>

      {reportSections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.cards.map((card) => (
              <button
                key={card.view}
                type="button"
                onClick={() => handleSelectView(card.view)}
                className="group rounded-2xl text-right outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex h-full items-center gap-4 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-6">
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-base font-semibold">{card.title}</h3>
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {card.subtitle}
                      </p>
                    </div>
                    <ArrowUpLeft className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:translate-y-1" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReportViewScreen({
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

function toReportView(value: string | null): ReportView | null {
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

function ReportShell({
  title,
  description,
  onBack,
  children,
}: {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft />
          رجوع للتقارير
        </Button>
      </header>
      {children}
    </div>
  );
}

function ReportActions({
  onExportCsv,
  onPrint,
  disabled,
}: {
  onExportCsv: () => void;
  onPrint: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onExportCsv} disabled={disabled}>
        <Download />
        تصدير CSV
      </Button>
      <Button variant="outline" onClick={onPrint} disabled={disabled}>
        <Printer />
        طباعة
      </Button>
    </div>
  );
}

function DailySalesReportView({ onBack }: { onBack: () => void }) {
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

function PeriodSalesReportView({
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

function TopItemsReportView({ onBack }: { onBack: () => void }) {
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

function ProfitReportView({ onBack }: { onBack: () => void }) {
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

function ExpenseSummaryView({ onBack }: { onBack: () => void }) {
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

function PaymentMethodsReportView({ onBack }: { onBack: () => void }) {
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

function BalancesReportView({
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

function LowStockReportView({ onBack }: { onBack: () => void }) {
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

function BalancePaymentDialog({
  kind,
  row,
  onOpenChange,
}: {
  kind: BalanceKind;
  row: BalanceRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const activeSession = useSessionStore((state) => state.activeSession);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const mutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error("No row selected");
      const command =
        kind === "customer"
          ? "record_customer_payment"
          : "record_supplier_payment";
      return invoke(
        command,
        {
          customerId: row.customer_id,
          supplierId: row.supplier_id,
          amountMillieme: toMillieme(amount),
          method,
          notes: null,
          sessionId: activeSession?.id ?? null,
        },
        { toast: false },
      );
    },
    onSuccess: () => {
      toast.success("تم تسجيل الدفعة");
      setAmount("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["report-balances", kind] });
      queryClient.invalidateQueries({
        queryKey: [kind === "customer" ? "customers" : "suppliers"],
      });
    },
    onError: () => toast.error("تعذر تسجيل الدفعة"),
  });

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تسجيل دفعة</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.name} — الرصيد الحالي ${formatEGP(row.balance_millieme)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (toMillieme(amount) <= 0) {
              toast.error("المبلغ يجب أن يكون أكبر من صفر");
              return;
            }
            mutation.mutate();
          }}
        >
          <FilterField label="المبلغ">
            <Input
              dir="rtl"
              type="number"
              step="0.001"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FilterField>
          <FilterField label="طريقة الدفع">
            <select
              dir="rtl"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="cash">كاش</option>
              <option value="card">فيزا</option>
              <option value="bank">تحويل بنكي</option>
            </select>
          </FilterField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              تسجيل
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FilterPanel({
  children,
  onSubmit,
  isLoading,
}: {
  children: ReactNode;
  onSubmit: () => void;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        {children}
        <div className="flex items-end">
          <Button className="w-full" onClick={onSubmit} disabled={isLoading}>
            عرض التقرير
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DateRangeFields({
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
}: {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
}) {
  return (
    <>
      <FilterField label="من تاريخ">
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
      </FilterField>
      <FilterField label="إلى تاريخ">
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
      </FilterField>
    </>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SectionCard
      title={title}
      withHeaderBorder
      contentClassName="h-[360px] p-4"
    >
      {children}
    </SectionCard>
  );
}

function BarChartBox({
  data,
  xKey,
  yKey,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
}) {
  return (
    <div dir="ltr" style={{ direction: "ltr" }} className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke="#2563eb"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarChartBox({ data }: { data: TopItemRow[] }) {
  return (
    <div dir="ltr" style={{ direction: "ltr" }} className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 24, right: 24 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name_ar" width={120} />
          <Tooltip />
          <Bar dataKey="total_qty_sold" fill="#2563eb" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartBox({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div dir="ltr" style={{ direction: "ltr" }} className="h-full min-h-70">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={105}
            label
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={chartColors[index % chartColors.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type DataTableProps = {
  columns: string[];
  empty: boolean;
  children: ReactNode;
};

const DataTable = forwardRef<HTMLTableElement, DataTableProps>(
  function DataTable({ columns, empty, children }, ref) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table ref={ref} className="min-w-full text-right">
              <thead className="bg-muted/40 text-sm text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empty ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-14 text-center text-muted-foreground"
                    >
                      لا توجد بيانات للعرض
                    </td>
                  </tr>
                ) : (
                  children
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  },
);

function TableHead({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 font-medium">{children}</th>
  );
}

function TableCell({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "whitespace-nowrap px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </td>
  );
}
