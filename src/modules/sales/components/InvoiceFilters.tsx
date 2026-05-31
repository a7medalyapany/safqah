import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { FilterField } from "@/shared/components/FilterField";

export function InvoiceFilters({
  dateFrom,
  dateTo,
  customerSearch,
  status,
  paymentMethod,
  onDateFromChange,
  onDateToChange,
  onCustomerSearchChange,
  onStatusChange,
  onPaymentMethodChange,
}: {
  dateFrom: string;
  dateTo: string;
  customerSearch: string;
  status: string;
  paymentMethod: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCustomerSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
      <FilterField label="من تاريخ">
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </FilterField>
      <FilterField label="إلى تاريخ">
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </FilterField>
      <FilterField label="العميل">
        <div className="relative">
          <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            dir="rtl"
            className="pe-9"
            placeholder="ابحث باسم العميل..."
            value={customerSearch}
            onChange={(event) => onCustomerSearchChange(event.target.value)}
          />
        </div>
      </FilterField>
      <FilterField label="الحالة">
        <select
          dir="rtl"
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="">الكل</option>
          <option value="paid">مدفوع</option>
          <option value="deferred">آجل</option>
          <option value="partial">جزئي</option>
          <option value="cancelled">ملغي</option>
        </select>
      </FilterField>
      <FilterField label="طريقة الدفع">
        <select
          dir="rtl"
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={paymentMethod}
          onChange={(event) => onPaymentMethodChange(event.target.value)}
        >
          <option value="">الكل</option>
          <option value="cash">كاش</option>
          <option value="card">فيزا</option>
          <option value="deferred">آجل</option>
        </select>
      </FilterField>
    </div>
  );
}
