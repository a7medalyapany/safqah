import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseAppError } from "@/modules/items/utils";
import type { DeferredInvoiceSummary, PaymentMethod } from "@/modules/finance/types";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP, toMillieme } from "@/shared/utils/money";

export function CollectPaymentDialog({
  invoice,
  onOpenChange,
  sessionId,
}: {
  invoice: DeferredInvoiceSummary | null;
  onOpenChange: (open: boolean) => void;
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  useEffect(() => {
    if (invoice) {
      setAmount("");
      setMethod("cash");
    }
  }, [invoice]);

  const mutation = useMutation({
    mutationFn: () =>
      invoke<{ status: string; paid_millieme: number }>(
        "record_invoice_payment",
        {
          invoiceId: invoice!.invoice_id,
          amountMillieme: toMillieme(amount),
          method,
          sessionId,
        },
      ),
    onSuccess: (result) => {
      if (result.status === "paid") {
        toast.success("تم سداد الفاتورة بالكامل");
      } else {
        toast.success("تم تسجيل الدفعة");
      }

      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deferred-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);

      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!amount || toMillieme(amount) <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    mutation.mutate();
  };

  const remaining = invoice ? invoice.remaining_millieme : 0;
  const maxEgp = remaining / 1000;

  return (
    <Dialog
      open={invoice !== null}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تسجيل دفعة</DialogTitle>
          <DialogDescription>تسجيل دفعة على فاتورة آجلة.</DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="mb-2 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">العميل</span>
              <span className="font-medium">{invoice.customer_name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">رقم الفاتورة</span>
              <span className="font-medium">{invoice.invoice_number}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">الإجمالي</span>
              <span>{formatEGP(invoice.total_millieme)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">المدفوع</span>
              <span>{formatEGP(invoice.paid_millieme)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">المتبقي</span>
              <span className="font-medium text-destructive">
                {formatEGP(remaining)}
              </span>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
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
              max={maxEgp > 0 ? maxEgp : undefined}
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
              <option value="bank">تحويل</option>
            </select>
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              تسجيل الدفعة
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

// ── Helpers ─────────────────────────────────────────────────────────────────
