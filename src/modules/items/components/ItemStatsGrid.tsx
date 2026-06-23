import { Boxes, CircleAlert, PackageSearch, Trash2 } from "lucide-react";

import { StatCard } from "@/shared/components/StatCard";

type ItemStats = {
  totalItems: number;
  totalStock: number;
  lowStock: number;
  outOfStock: number;
};

export function ItemStatsGrid({ stats }: { stats: ItemStats }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="إجمالي الأصناف"
        value={stats.totalItems}
        icon={<Boxes className="size-5" />}
      />
      <StatCard
        title="إجمالي الكميات"
        value={stats.totalStock}
        icon={<PackageSearch className="size-5" />}
      />
      <StatCard
        title="مخزون منخفض"
        value={stats.lowStock}
        icon={<CircleAlert className="size-5" />}
      />
      <StatCard
        title="نافذ المخزون"
        value={stats.outOfStock}
        icon={<Trash2 className="size-5" />}
      />
    </section>
  );
}
