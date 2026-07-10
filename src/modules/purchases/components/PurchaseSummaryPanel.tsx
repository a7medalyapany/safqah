import { Input } from "@/components/ui/input";
import { formatEGP } from "@/shared/utils/money";

import { FilterField, SummaryRow } from "./PurchasePrimitives";

export function PurchaseSummaryPanel({
  subtotalMillieme,
  discount,
  onDiscountChange,
  totalMillieme,
  paid,
  onPaidChange,
  remainingMillieme,
}: {
  subtotalMillieme: number;
  discount: string;
  onDiscountChange: (value: string) => void;
  totalMillieme: number;
  paid: string;
  onPaidChange: (value: string) => void;
  remainingMillieme: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryRow label="المجموع الفرعي" value={formatEGP(subtotalMillieme)} />
        <FilterField label="الخصم">
          <Input
            type="number"
            step="0.001"
            min={0}
            value={discount}
            onChange={(event) => onDiscountChange(event.target.value)}
          />
        </FilterField>
        <SummaryRow label="الإجمالي" value={formatEGP(totalMillieme)} strong />
        <FilterField label="المدفوع">
          <Input
            type="number"
            step="0.001"
            min={0}
            value={paid}
            onChange={(event) => onPaidChange(event.target.value)}
          />
        </FilterField>
        <SummaryRow label="المتبقي" value={formatEGP(remainingMillieme)} />
      </div>
    </div>
  );
}
