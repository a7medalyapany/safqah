import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/modules/dashboard/components/DashboardStates";
import type { LowStockItem } from "@/modules/dashboard/types";
import { SectionCard } from "@/shared/components/SectionCard";

type LowStockPanelProps = {
  items: LowStockItem[];
  isLoading: boolean;
  isError: boolean;
  loadingFallback: ReactNode;
};

export function LowStockPanel({
  items,
  isLoading,
  isError,
  loadingFallback,
}: LowStockPanelProps) {
  return (
    <SectionCard
      title="أصناف منخفضة المخزون"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports?view=low-stock">عرض الكل</Link>
        </Button>
      }
    >
      {isLoading ? loadingFallback : isError ? <ErrorState /> : <LowStockList items={items} />}
    </SectionCard>
  );
}

function LowStockList({ items }: { items: LowStockItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState className="h-auto min-h-24 border-emerald-200 bg-emerald-50 text-emerald-700">
        ✓ المخزون في وضع جيد
      </EmptyState>
    );
  }

  return (
    <div className="divide-y">
      {items.slice(0, 5).map((item) => (
        <div
          key={item.item_id}
          className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{item.name_ar}</p>
            <p className="text-xs text-muted-foreground">الحد الأدنى: {item.min_stock}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="destructive">المخزون {item.current_stock}</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link to="/items">إدارة المخزون</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
