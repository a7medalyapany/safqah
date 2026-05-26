import {
  Banknote,
  CreditCard,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DailySalesReport } from "@/modules/dashboard/types";
import { formatEGP } from "@/shared/utils/money";

type Tone = "green" | "blue" | "teal" | "orange";

type KpiCardsProps = {
  dailySales?: DailySalesReport;
  isLoading: boolean;
  isError: boolean;
};

export function KpiCards({ dailySales, isLoading, isError }: KpiCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="مبيعات اليوم"
        value={formatEGP(dailySales?.total_millieme ?? 0)}
        tone="green"
        icon={<TrendingUp />}
        isLoading={isLoading}
        isError={isError}
      />
      <KpiCard
        title="فواتير اليوم"
        value={dailySales?.invoice_count ?? 0}
        tone="blue"
        icon={<ReceiptText />}
        isLoading={isLoading}
        isError={isError}
      />
      <KpiCard
        title="نقدي اليوم"
        value={formatEGP(dailySales?.cash_millieme ?? 0)}
        tone="teal"
        icon={<Banknote />}
        isLoading={isLoading}
        isError={isError}
      />
      <KpiCard
        title="آجل اليوم"
        value={formatEGP(dailySales?.deferred_millieme ?? 0)}
        tone="orange"
        icon={<CreditCard />}
        isLoading={isLoading}
        isError={isError}
      />
    </section>
  );
}

function KpiCard({
  title,
  value,
  tone,
  icon,
  isLoading,
  isError,
}: {
  title: string;
  value: ReactNode;
  tone: Tone;
  icon: ReactNode;
  isLoading: boolean;
  isError: boolean;
}) {
  const toneClassNames: Record<Tone, string> = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    orange: "bg-orange-50 text-orange-700",
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <p
              className={cn(
                "truncate text-2xl font-semibold tracking-tight",
                isError && "text-destructive",
              )}
            >
              {isError ? "تعذر التحميل" : value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg [&_svg]:size-6",
            toneClassNames[tone],
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
