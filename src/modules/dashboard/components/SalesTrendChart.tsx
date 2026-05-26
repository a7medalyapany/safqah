import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { SalesTrendPoint } from "@/modules/dashboard/types";
import { formatEGP } from "@/shared/utils/money";

type ChartMouseState = {
  isTooltipActive?: boolean;
  chartX?: number;
  chartY?: number;
  activePayload?: { payload?: SalesTrendPoint }[];
};

export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const [activePoint, setActivePoint] = useState<SalesTrendPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const summary = useMemo(() => {
    const totalMillieme = data.reduce((sum, point) => sum + point.total_millieme, 0);
    const bestDay = data.reduce<SalesTrendPoint | null>(
      (best, point) => (!best || point.total_millieme > best.total_millieme ? point : best),
      null,
    );

    return { totalMillieme, bestDay };
  }, [data]);

  const visiblePoint = activePoint ?? summary.bestDay;

  return (
    <div className="space-y-3">
      <div
        dir="ltr"
        style={{ direction: "ltr" }}
        className="relative h-[250px] min-w-0"
      >
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
            onMouseMove={(state: ChartMouseState) => {
              const nextPoint = state.isTooltipActive
                ? state.activePayload?.[0]?.payload ?? null
                : null;
              setActivePoint((current) =>
                current?.iso === nextPoint?.iso ? current : nextPoint,
              );
              if (nextPoint && state.chartX !== undefined && state.chartY !== undefined) {
                setTooltipPosition({ x: state.chartX, y: state.chartY });
              }
            }}
            onMouseLeave={() => {
              setActivePoint(null);
            }}
          >
            <defs>
              <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={56} />
            <Area
              type="monotone"
              dataKey="total_egp"
              stroke="#7c3aed"
              strokeWidth={3}
              fill="url(#salesTrendGradient)"
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {activePoint ? (
          <div
            dir="rtl"
            className="pointer-events-none absolute z-10 min-w-44 rounded-lg border bg-popover px-3 py-2 text-right text-xs shadow-md"
            style={{
              left: tooltipPosition.x,
              top: Math.max(tooltipPosition.y - 54, 8),
              transform:
                tooltipPosition.x > 260
                  ? "translateX(calc(-100% - 12px))"
                  : "translateX(12px)",
            }}
          >
            <p className="font-semibold text-foreground">{activePoint.label}</p>
            <p className="mt-1 text-muted-foreground">إجمالي المبيعات</p>
            <p className="mt-0.5 font-semibold text-violet-700">
              {formatEGP(activePoint.total_millieme)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-2">
        <Metric label="إجمالي 7 أيام" value={formatEGP(summary.totalMillieme)} />
        <Metric
          label={activePoint ? `اليوم المحدد: ${activePoint.label}` : "أعلى يوم"}
          value={visiblePoint ? formatEGP(visiblePoint.total_millieme) : formatEGP(0)}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
