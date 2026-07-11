import { Input } from "@/components/ui/input";
import { moneyToInput } from "@/modules/pos/utils";
import { formatEGP, toMillieme } from "@/shared/utils/money";

export function TotalsPanel({
  subtotalMillieme,
  globalDiscountMillieme,
  totalMillieme,
  totalDiscountMillieme,
  onSetGlobalDiscount,
}: {
  subtotalMillieme: number;
  globalDiscountMillieme: number;
  totalMillieme: number;
  totalDiscountMillieme: number;
  onSetGlobalDiscount: (discountMillieme: number) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-2xl border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            المجموع الفرعي
          </span>
          <span className="text-sm font-medium">
            {formatEGP(subtotalMillieme)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            الخصم الإجمالي
          </span>
          <Input
            key={`global-discount-${globalDiscountMillieme}`}
            dir="rtl"
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-24 text-center text-sm"
            defaultValue={moneyToInput(globalDiscountMillieme)}
            onBlur={(event) => {
              try {
                onSetGlobalDiscount(toMillieme(event.target.value || 0));
              } catch {
                onSetGlobalDiscount(0);
                event.target.value = "0";
              }
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">الإجمالي</span>
          <span className="text-lg font-bold">
            {formatEGP(totalMillieme)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          إجمالي الخصم: {formatEGP(totalDiscountMillieme)}
        </span>
      </div>
    </div>
  );
}
