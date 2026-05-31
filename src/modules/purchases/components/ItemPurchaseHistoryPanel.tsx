import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ItemPurchaseHistory } from "@/modules/purchases/types";
import { calculateProfitMargin, formatDateOnly, formatMarginLabel } from "@/modules/purchases/utils";
import { formatEGP } from "@/shared/utils/money";
import { SummaryRow } from "./PurchasePrimitives";

export function ItemPurchaseHistoryPanel({
  isLoading,
  history,
  fallbackItemName,
}: {
  isLoading: boolean;
  history: ItemPurchaseHistory | null;
  fallbackItemName: string;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-background p-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
    );
  }

  if (!history) {
    return null;
  }

  const hasHistory = history.purchase_count > 0;
  const baseCost =
    history.last_purchase_cost_millieme ?? history.current_buy_price_millieme;
  const currentMargin = calculateProfitMargin(
    baseCost,
    history.current_sell_price_millieme,
  );

  return (
    <div className="rounded-xl border bg-background p-4 text-sm">
      <p className="font-semibold">
        سجل الشراء — {history.name_ar || fallbackItemName}
      </p>
      <div className="mt-3 space-y-2">
        {hasHistory ? (
          <>
            <SummaryRow
              label="آخر سعر شراء"
              value={`${formatEGP(history.last_purchase_cost_millieme ?? 0)}${history.last_purchase_date ? ` (${formatDateOnly(history.last_purchase_date)})` : ""}`}
            />
            <SummaryRow
              label="من مورد"
              value={history.last_supplier_name || "غير محدد"}
            />
            <SummaryRow
              label="آخر كمية"
              value={`${history.last_purchase_qty ?? 0} قطعة`}
            />
          </>
        ) : (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            لم يتم شراء هذا الصنف من قبل — يمكنك تحديد السعر يدوياً
          </p>
        )}

        <Separator className="my-2" />

        <SummaryRow
          label="متوسط سعر الشراء"
          value={
            history.avg_cost_millieme !== null
              ? `${formatEGP(history.avg_cost_millieme)} (من ${history.purchase_count} عمليات شراء)`
              : "لا يوجد"
          }
        />

        <Separator className="my-2" />

        <SummaryRow
          label="سعر البيع الحالي"
          value={formatEGP(history.current_sell_price_millieme)}
        />
        <SummaryRow
          label="هامش الربح الحالي"
          value={
            <span
              className={cn(
                currentMargin === null
                  ? "text-muted-foreground"
                  : currentMargin > 20
                    ? "text-emerald-700"
                    : currentMargin >= 10
                      ? "text-amber-700"
                      : "text-red-700",
              )}
            >
              {formatMarginLabel(currentMargin)}
            </span>
          }
        />
      </div>
    </div>
  );
}
