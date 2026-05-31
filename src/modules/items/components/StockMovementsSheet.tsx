import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, PackageSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  MOVEMENTS_PAGE_SIZE,
  movementTypeLabels,
} from "@/modules/items/constants";
import { useItemMovements } from "@/modules/items/hooks";
import type { Item } from "@/modules/items/types";
import { getItemStockTone } from "@/modules/items/utils";
import { formatDate } from "@/shared/utils/date";

export function StockMovementsSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}) {
  const [visibleLimit, setVisibleLimit] = useState(MOVEMENTS_PAGE_SIZE);

  useEffect(() => {
    if (item) {
      setVisibleLimit(MOVEMENTS_PAGE_SIZE);
    }
  }, [item]);

  const movementsQuery = useItemMovements({
    itemId: item?.id,
    limit: visibleLimit,
    enabled: Boolean(item) && open,
  });

  const movements = movementsQuery.data ?? [];
  const hasMore = movements.length >= visibleLimit;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent dir="rtl">
        <SheetHeader>
          <SheetTitle>
            {item ? `حركة المخزون — ${item.name_ar}` : "حركة المخزون"}
          </SheetTitle>
          <SheetDescription>
            {item ? "سجل تدفق المخزون لهذا الصنف." : "جارٍ تحميل الصنف..."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Badge
              variant="outline"
              className={item ? getItemStockTone(item) : ""}
            >
              {item
                ? `الرصيد الحالي: ${item.current_stock} قطعة`
                : "الرصيد الحالي: —"}
            </Badge>
          </div>

          {movementsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <PackageSearch className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                لا توجد حركات مخزون لهذا الصنف
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => {
                const isPositive = movement.delta > 0;
                const deltaLabel = `${isPositive ? "+" : ""}${movement.delta}`;
                const referenceTarget =
                  movement.movement_type === "purchase"
                    ? "/purchases"
                    : "/sales";
                const canLinkReference =
                  movement.movement_type === "purchase" ||
                  movement.movement_type === "sale";

                return (
                  <div
                    key={movement.id}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 rounded-full p-2",
                          isPositive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {isPositive ? (
                          <ArrowUp className="size-4" />
                        ) : (
                          <ArrowDown className="size-4" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {movementTypeLabels[movement.movement_type]}
                          </span>
                          <span
                            className={cn(
                              "font-semibold",
                              isPositive
                                ? "text-emerald-700"
                                : "text-destructive",
                            )}
                          >
                            {deltaLabel}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>المرجع:</span>
                            {movement.reference_number && canLinkReference ? (
                              <Button
                                variant="link"
                                size="xs"
                                className="h-auto p-0 text-xs"
                                asChild
                              >
                                <Link to={referenceTarget}>
                                  {movement.reference_number}
                                </Link>
                              </Button>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          <span>{formatDate(movement.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setVisibleLimit((current) => current + MOVEMENTS_PAGE_SIZE)
                }
                disabled={movementsQuery.isFetching}
              >
                تحميل المزيد
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
