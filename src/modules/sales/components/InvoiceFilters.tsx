import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterField } from "@/shared/components/FilterField";

export function InvoiceFilters({
  dateFrom,
  dateTo,
  customerSearch,
  invoiceSearch,
  status,
  paymentMethod,
  onDateFromChange,
  onDateToChange,
  onCustomerSearchChange,
  onInvoiceSearchChange,
  onStatusChange,
  onPaymentMethodChange,
}: {
  dateFrom: string;
  dateTo: string;
  customerSearch: string;
  invoiceSearch: string;
  status: string;
  paymentMethod: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCustomerSearchChange: (value: string) => void;
  onInvoiceSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-6">
      <FilterField label="فاتورة / منتج">
        <div className="relative">
          <Search className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            dir="rtl"
            className="pe-9"
            placeholder="رقم الفاتورة أو اسم/باركود منتج..."
            value={invoiceSearch}
            onChange={(event) => onInvoiceSearchChange(event.target.value)}
          />
        </div>
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
      <FilterField label="الحالة">
        <Select value={status || "all"} onValueChange={(value) => onStatusChange(value === "all" ? "" : value)}>
          <SelectTrigger dir="rtl" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="paid">مدفوع</SelectItem>
            <SelectItem value="deferred">آجل</SelectItem>
            <SelectItem value="partial">جزئي</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="طريقة الدفع">
        <Select value={paymentMethod || "all"} onValueChange={(value) => onPaymentMethodChange(value === "all" ? "" : value)}>
          <SelectTrigger dir="rtl" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="cash">كاش</SelectItem>
            <SelectItem value="card">فيزا</SelectItem>
            <SelectItem value="deferred">آجل</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}
