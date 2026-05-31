import { UserRound, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { Customer } from "@/modules/parties/types";
import { formatEGP } from "@/shared/utils/money";

export function CustomerPanel({
  customerSearch,
  customerId,
  onCustomerSearchChange,
  onClearCustomer,
  onSelectCustomer,
  customers,
  showResults,
  selectedCustomer,
}: {
  customerSearch: string;
  customerId: number | null;
  onCustomerSearchChange: (value: string) => void;
  onClearCustomer: () => void;
  onSelectCustomer: (customer: Customer) => void;
  customers: Customer[];
  showResults: boolean;
  selectedCustomer: Customer | null;
}) {
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">العميل</label>
        <div className="relative">
          <UserRound className="absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            dir="rtl"
            className="pe-9"
            placeholder="اختر عميل (اختياري)"
            value={customerSearch}
            onChange={(event) => onCustomerSearchChange(event.target.value)}
          />
          {customerId ? (
            <button
              type="button"
              className="absolute inset-s-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={onClearCustomer}
              aria-label="مسح العميل"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {showResults ? (
          <div className="max-h-48 overflow-y-auto rounded-xl border bg-background">
            {customers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                لا يوجد عملاء مطابقون
              </div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-right hover:bg-muted/40"
                  onClick={() => onSelectCustomer(customer)}
                >
                  <span>{customer.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatEGP(customer.balance_millieme)}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {selectedCustomer ? (
        <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{selectedCustomer.name}</span>
            <span>{formatEGP(selectedCustomer.balance_millieme)}</span>
          </div>
          {selectedCustomer.balance_millieme > 0 ? (
            <p className="font-medium text-amber-700">
              مديونية: {formatEGP(selectedCustomer.balance_millieme)}
            </p>
          ) : selectedCustomer.balance_millieme < 0 ? (
            <p className="font-medium text-emerald-700">
              رصيد دائن للعميل:{" "}
              {formatEGP(Math.abs(selectedCustomer.balance_millieme))}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
