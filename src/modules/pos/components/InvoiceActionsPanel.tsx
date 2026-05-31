import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InvoiceActionsPanel({
  notes,
  onNotesChange,
  isSubmitDisabled,
  isSubmitting,
  totalLabel,
  onSubmit,
  onClear,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  totalLabel: string;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">ملاحظات</label>
        <Input
          dir="rtl"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="ملاحظات اختيارية"
        />
      </div>

      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold"
        disabled={isSubmitDisabled}
        onClick={onSubmit}
      >
        {isSubmitting ? "جارٍ حفظ الفاتورة..." : `إتمام البيع — ${totalLabel}`}
      </Button>
      <Button
        variant="destructive"
        className="w-full"
        disabled={isSubmitting}
        onClick={onClear}
      >
        مسح الفاتورة
      </Button>
    </div>
  );
}
