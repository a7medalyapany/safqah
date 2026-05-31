import { ArrowLeft, Download, Printer } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chartColors } from "@/modules/reports/constants";
import type { TopItemRow } from "@/modules/reports/types";
import { SectionCard } from "@/shared/components/SectionCard";

export function ReportShell({
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

export function ReportActions({
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
export function FilterPanel({
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

export function DateRangeFields({
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

export function FilterField({
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

export function KpiCard({
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

export function ChartCard({
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

export function BarChartBox({
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

export function HorizontalBarChartBox({ data }: { data: TopItemRow[] }) {
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

export function PieChartBox({ data }: { data: { name: string; value: number }[] }) {
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

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(
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

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 font-medium">{children}</th>
  );
}

export function TableCell({
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
