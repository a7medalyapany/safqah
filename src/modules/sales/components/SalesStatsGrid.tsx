import { Banknote, Clock3, CreditCard, ReceiptText } from "lucide-react";

import type { InvoiceStats } from "@/modules/sales/types";
import { StatCard } from "@/shared/components/StatCard";
import { formatEGP } from "@/shared/utils/money";

export function SalesStatsGrid({
  stats,
  isLoading,
}: {
  stats: InvoiceStats;
  isLoading: boolean;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="إجمالي الفواتير"
        value={isLoading ? "..." : stats.total_count}
        icon={<ReceiptText className="size-5" />}
      />
      <StatCard
        title="فواتير مدفوعة"
        value={isLoading ? "..." : stats.paid_count}
        icon={<Banknote className="size-5" />}
      />
      <StatCard
        title="فواتير آجلة"
        value={isLoading ? "..." : stats.deferred_count}
        icon={<Clock3 className="size-5" />}
      />
      <StatCard
        title="إجمالي المبيعات"
        value={isLoading ? "..." : formatEGP(stats.total_sales_millieme)}
        icon={<CreditCard className="size-5" />}
      />
    </section>
  );
}
