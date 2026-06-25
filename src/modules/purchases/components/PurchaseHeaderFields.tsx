import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Supplier } from "@/modules/parties/types";
import type { PaymentMethod } from "@/modules/purchases/types";

import { FilterField } from "./PurchasePrimitives";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "كاش" },
  { value: "deferred", label: "آجل" },
  { value: "partial", label: "جزئي" },
] as const;

export function PurchaseHeaderFields({
  supplierId,
  onSupplierIdChange,
  suppliers,
  paymentMethod,
  onPaymentMethodChange,
  isEditMode,
  invoiceDate,
  onInvoiceDateChange,
  notes,
  onNotesChange,
}: {
  supplierId: string;
  onSupplierIdChange: (value: string) => void;
  suppliers: Supplier[];
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  isEditMode: boolean;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <FilterField label="المورد (اختياري)">
          <select
            dir="rtl"
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={supplierId}
            onChange={(event) => onSupplierIdChange(event.target.value)}
          >
            <option value="">بدون مورد</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={String(supplier.id)}>
                {supplier.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="طريقة الدفع">
          <div className="flex flex-wrap gap-2">
            {PAYMENT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={paymentMethod === option.value ? "default" : "outline"}
                onClick={() => onPaymentMethodChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </FilterField>

        {isEditMode ? (
          <FilterField label="تاريخ الفاتورة">
            <Input
              type="date"
              value={invoiceDate}
              onChange={(event) => onInvoiceDateChange(event.target.value)}
            />
          </FilterField>
        ) : null}
      </div>

      <FilterField label="ملاحظات">
        <textarea
          dir="rtl"
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="أضف ملاحظات إضافية (اختياري)"
        />
      </FilterField>
    </>
  );
}
