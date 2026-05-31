import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import type { Customer } from "@/modules/parties/types";
import type { PaymentMethod } from "@/modules/finance/types";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP, toMillieme } from "@/shared/utils/money";

export function ReceiptVoucherDialog({
  open,
  onOpenChange,
  customers,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const filtered = customers.filter((c) => c.name.includes(search));
  const selected = customers.find((c) => c.id === selectedId);
  const maxMillieme = selected ? Math.max(selected.balance_millieme, 0) : 0;

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        "record_customer_payment",
        {
          customerId: selectedId,
          amountMillieme: toMillieme(amount),
          method,
          notes: notes.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success("تم تسجيل سند القبض بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);
      setSelectedId(null);
      setSearch("");
      setAmount("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedId) {
      toast.error("اختر عميلاً");
      return;
    }

    if (!amount || toMillieme(amount) <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>سند قبض جديد</DialogTitle>
          <DialogDescription>تسجيل مبلغ مستلم من عميل.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              اختر عميل <span className="text-destructive">*</span>
            </label>
            <Input
              dir="rtl"
              placeholder="ابحث باسم العميل..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(null);
              }}
            />
            {search && (
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    لا توجد نتائج
                  </p>
                ) : (
                  filtered.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-right text-sm transition-colors hover:bg-muted",
                        selectedId === customer.id &&
                          "bg-primary/10 font-medium",
                      )}
                      onClick={() => {
                        setSelectedId(customer.id);
                        setSearch(customer.name);
                      }}
                    >
                      {customer.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && selected.balance_millieme > 0 && (
              <p className="text-sm text-orange-600">
                المديونية الحالية: {formatEGP(selected.balance_millieme)}
              </p>
            )}
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ المستلم <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max={
                maxMillieme > 0 ? (maxMillieme / 1000).toString() : undefined
              }
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              طريقة الاستلام
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as PaymentMethod)
              }
            >
              <option value="cash">كاش</option>
              <option value="card">فيزا</option>
              <option value="bank">تحويل بنكي</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              ملاحظات
            </span>
            <textarea
              dir="rtl"
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              حفظ السند
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
