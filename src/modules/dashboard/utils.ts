import type {
  DayPoint,
  InvoiceStatus,
  PeriodSalesRow,
  SalesTrendPoint,
} from "@/modules/dashboard/types";

export const statusLabels: Record<InvoiceStatus, string> = {
  paid: "مدفوع",
  deferred: "آجل",
  partial: "جزئي",
  cancelled: "ملغي",
};

export const statusClassNames: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  deferred: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  partial: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
};

const arabicShortDateFormatter = new Intl.DateTimeFormat("ar-EG", {
  month: "short",
  day: "numeric",
});

export function buildSalesTrend(days: DayPoint[], rows: PeriodSalesRow[]): SalesTrendPoint[] {
  const totalsByDate = new Map(
    rows.map((row) => [row.period_label.slice(0, 10), row.total_millieme]),
  );

  return days.map((day) => {
    const totalMillieme = totalsByDate.get(day.iso) ?? 0;

    return {
      ...day,
      total_millieme: totalMillieme,
      total_egp: totalMillieme / 1000,
    };
  });
}

export function lastDays(count: number): DayPoint[] {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (count - 1 - index));

    return {
      iso: toIsoDate(date),
      label: arabicShortDateFormatter.format(date),
    };
  });
}

export function today() {
  return toIsoDate(new Date());
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
