import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import type { Customer } from "@/modules/parties/types";
import { formatEGP, toMillieme } from "@/shared/utils/money";

type PaymentMethod = "cash" | "card" | "bank";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش",
  card: "فيزا",
  bank: "تحويل",
};

type DeferredInvoice = {
  invoice_id: number;
  invoice_number: string;
  created_at: string;
  total_millieme: number;
  paid_millieme: number;
  remaining_millieme: number;
  status: string;
};

type Payment = {
  id: number;
  entity_type: string;
  entity_id: number;
  amount_millieme: number;
  direction: string;
  method: string;
  reference_invoice_id: number | null;
  notes: string | null;
  session_id: number | null;
  created_at: string;
};

type CustomerLedger = {
  customer: Customer;
  deferred_invoices: DeferredInvoice[];
  payments: Payment[];
  total_owed_millieme: number;
};

export function CustomerLedgerSheet({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [paymentInvoice, setPaymentInvoice] = useState<DeferredInvoice | null>(
    null,
  );

  const ledgerQuery = useQuery({
    queryKey: ["customer-ledger", customerId],
    queryFn: () =>
      invoke<CustomerLedger>("get_customer_ledger", {
        customerId,
      }),
    enabled: open && customerId !== null,
  });

  const ledger = ledgerQuery.data;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent dir="rtl" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {ledger?.customer.name ?? "سجل العميل"}
            </SheetTitle>
            <SheetDescription>
              سجل المديونية والدفعات للعميل.
            </SheetDescription>
          </SheetHeader>

          {ledgerQuery.isLoading || !ledger ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {/* Customer info */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">الاسم</span>
                    <span className="font-medium">
                      {ledger.customer.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">الهاتف</span>
                    <span className="font-medium">
                      {ledger.customer.phone || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">العنوان</span>
                    <span className="font-medium">
                      {ledger.customer.address || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">الرصيد الحالي</span>
                    <span
                      className={cn(
                        "font-medium",
                        ledger.total_owed_millieme > 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatEGP(ledger.total_owed_millieme)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deferred invoices */}
              <div>
                <h3 className="mb-2 text-base font-semibold">
                  الفواتير الآجلة
                </h3>
                {ledger.deferred_invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لا توجد فواتير آجلة
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ledger.deferred_invoices.map((inv) => (
                      <div
                        key={inv.invoice_id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {inv.invoice_number}
                          </span>
                          <span className="text-destructive">
                            {formatEGP(inv.remaining_millieme)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                          <span>
                            الإجمالي: {formatEGP(inv.total_millieme)} | المدفوع:{" "}
                            {formatEGP(inv.paid_millieme)}
                          </span>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setPaymentInvoice(inv)}
                          >
                            تسجيل دفعة
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment history */}
              <div>
                <h3 className="mb-2 text-base font-semibold">سجل الدفعات</h3>
                {ledger.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لا توجد دفعات
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ledger.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {formatEGP(payment.amount_millieme)}
                          </span>
                          <span className="text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[
                              payment.method as PaymentMethod
                            ] ?? payment.method}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(payment.created_at)}
                          {payment.reference_invoice_id
                            ? ` | فاتورة رقم ${payment.reference_invoice_id}`
                            : ""}
                          {payment.notes ? ` | ${payment.notes}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total owed */}
              <div
                className={cn(
                  "rounded-lg border-2 p-4 text-center",
                  ledger.total_owed_millieme > 0
                    ? "border-destructive/20 bg-destructive/5"
                    : "border-muted",
                )}
              >
                <p className="text-sm text-muted-foreground">
                  إجمالي المديونية
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    ledger.total_owed_millieme > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {formatEGP(ledger.total_owed_millieme)}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CollectPaymentDialogInline
        invoice={paymentInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentInvoice(null);
          }
        }}
      />
    </>
  );
}

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function CollectPaymentDialogInline({
  invoice,
  onOpenChange,
}: {
  invoice: DeferredInvoice | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const mutation = useMutation({
    mutationFn: () =>
      invoke<{ status: string }>("record_invoice_payment", {
        invoiceId: invoice!.invoice_id,
        amountMillieme: toMillieme(amount),
        method,
        sessionId: null,
      }),
    onSuccess: (result) => {
      if (result.status === "paid") {
        toast.success("تم سداد الفاتورة بالكامل");
      } else {
        toast.success("تم تسجيل الدفعة");
      }

      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["deferred-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
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
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تسجيل دفعة</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="mb-2 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
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
