import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { moneyToInput } from "@/modules/pos/utils";
import { SummaryRow } from "@/shared/components/SummaryRow";
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
    <div className="space-y-3 rounded-2xl border p-4">
      <SummaryRow label="المجموع الفرعي" value={formatEGP(subtotalMillieme)} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">الخصم الإجمالي</span>
        <div className="flex items-center gap-2">
          {/* <span className="text-sm text-muted-foreground">ج.م</span> */}
          <Input
            key={`global-discount-${globalDiscountMillieme}`}
            dir="rtl"
            type="number"
            min={0}
            step="0.01"
            className="w-28 text-center"
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
      <Separator />
      <SummaryRow
        label="الإجمالي"
        value={formatEGP(totalMillieme)}
        className="text-lg font-bold"
      />
      <div className="text-sm text-muted-foreground">
        إجمالي الخصم: {formatEGP(totalDiscountMillieme)}
      </div>
    </div>
  );
}
