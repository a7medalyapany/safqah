import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import type { Supplier } from "@/modules/parties/types";
import type { PaymentMethod } from "@/modules/finance/types";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP, toMillieme } from "@/shared/utils/money";

export function PaymentVoucherDialog({
  open,
  onOpenChange,
  suppliers,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const filtered = suppliers.filter((s) => s.name.includes(search));
  const selected = suppliers.find((s) => s.id === selectedId);

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        "record_supplier_payment",
        {
          supplierId: selectedId,
          amountMillieme: toMillieme(amount),
          method,
          notes: notes.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success("تم تسجيل سند الصرف بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
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
      toast.error("اختر مورداً");
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
          <DialogTitle>سند صرف جديد</DialogTitle>
          <DialogDescription>تسجيل مبلغ مدفوع لمورد.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              اختر مورد <span className="text-destructive">*</span>
            </label>
            <Input
              dir="rtl"
              placeholder="ابحث باسم المورد..."
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
                  filtered.map((supplier) => (
                    <button
                      key={supplier.id}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-right text-sm transition-colors hover:bg-muted",
                        selectedId === supplier.id &&
                          "bg-primary/10 font-medium",
                      )}
                      onClick={() => {
                        setSelectedId(supplier.id);
                        setSearch(supplier.name);
                      }}
                    >
                      {supplier.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && selected.balance_millieme > 0 && (
              <p className="text-sm text-orange-600">
                المستحق للمورد: {formatEGP(selected.balance_millieme)}
              </p>
            )}
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ المدفوع <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              طريقة الدفع
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
