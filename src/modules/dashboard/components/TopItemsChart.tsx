import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/modules/dashboard/components/DashboardStates";
import type { TopItemRow } from "@/modules/dashboard/types";
import { formatEGP } from "@/shared/utils/money";

type ChartMouseState = {
  isTooltipActive?: boolean;
  chartX?: number;
  chartY?: number;
  activePayload?: { payload?: TopItemRow }[];
};

export function TopItemsChart({ data }: { data: TopItemRow[] }) {
  const [activeItem, setActiveItem] = useState<TopItemRow | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const totalQty = useMemo(
    () => data.reduce((sum, item) => sum + item.total_qty_sold, 0),
    [data],
  );
  const visibleItem = activeItem ?? data[0] ?? null;

  if (data.length === 0) {
    return <EmptyState>لا توجد مبيعات بعد</EmptyState>;
  }

  return (
    <div className="space-y-3">
      <div
        dir="ltr"
        style={{ direction: "ltr" }}
        className="relative h-[250px] min-w-0"
      >
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 6, right: 12, left: 20, bottom: 0 }}
            onMouseMove={(state: ChartMouseState) => {
              const nextItem = state.isTooltipActive
                ? state.activePayload?.[0]?.payload ?? null
                : null;
              setActiveItem((current) =>
                current?.item_id === nextItem?.item_id ? current : nextItem,
              );
              if (nextItem && state.chartX !== undefined && state.chartY !== undefined) {
                setTooltipPosition({ x: state.chartX, y: state.chartY });
              }
            }}
            onMouseLeave={() => setActiveItem(null)}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name_ar"
              width={130}
              tickLine={false}
              axisLine={false}
            />
            <Bar
              dataKey="total_qty_sold"
              fill="#2563eb"
              radius={[0, 8, 8, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
        {activeItem ? (
          <div
            dir="rtl"
            className="pointer-events-none absolute z-10 min-w-52 rounded-lg border bg-popover px-3 py-2 text-right text-xs shadow-md"
            style={{
              left: tooltipPosition.x,
              top: Math.max(tooltipPosition.y - 62, 8),
              transform:
                tooltipPosition.x > 220
                  ? "translateX(calc(-100% - 12px))"
                  : "translateX(12px)",
            }}
          >
            <p className="truncate font-semibold text-foreground">{activeItem.name_ar}</p>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <InfoRow label="الكمية" value={activeItem.total_qty_sold} />
              <InfoRow label="الإيراد" value={formatEGP(activeItem.total_revenue_millieme)} />
              <InfoRow label="الربح" value={formatEGP(activeItem.gross_profit_millieme)} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-muted-foreground">
            {activeItem ? activeItem.name_ar : "إجمالي كميات أفضل الأصناف"}
          </span>
          <span className="font-semibold">
            {activeItem ? activeItem.total_qty_sold : totalQty}
          </span>
        </div>
        {visibleItem ? (
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>الإيراد</span>
            <span>{formatEGP(visibleItem.total_revenue_millieme)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
