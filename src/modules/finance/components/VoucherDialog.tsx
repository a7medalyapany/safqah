import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseAppError } from "@/modules/items/utils";
import type { PaymentMethod } from "@/modules/finance/types";
import { useInvalidate } from "@/shared/hooks/useInvalidate";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP, toMillieme } from "@/shared/utils/money";

/** Minimal shape shared by Customer and Supplier for the voucher picker. */
export type VoucherParty = {
  id: number;
  name: string;
  balance_millieme: number;
};

/** "in" = receipt voucher (money received from a customer); "out" = payment voucher (money paid to a supplier). */
export type VoucherDirection = "in" | "out";

const VOUCHER_COPY = {
  in: {
    title: "سند قبض جديد",
    description: "تسجيل مبلغ مستلم من عميل.",
    selectLabel: "اختر عميل",
    selectError: "اختر عميلاً",
    searchPlaceholder: "ابحث باسم العميل...",
    balanceLabel: "المديونية الحالية:",
    amountLabel: "المبلغ المستلم",
    methodLabel: "طريقة الاستلام",
    successToast: "تم تسجيل سند القبض بنجاح",
    command: "record_customer_payment",
    partyIdKey: "customerId",
    partyQueryKey: "customers",
    // A receipt cannot exceed what the customer currently owes.
    capAmountToBalance: true,
  },
  out: {
    title: "سند صرف جديد",
    description: "تسجيل مبلغ مدفوع لمورد.",
    selectLabel: "اختر مورد",
    selectError: "اختر مورداً",
    searchPlaceholder: "ابحث باسم المورد...",
    balanceLabel: "المستحق للمورد:",
    amountLabel: "المبلغ المدفوع",
    methodLabel: "طريقة الدفع",
    successToast: "تم تسجيل سند الصرف بنجاح",
    command: "record_supplier_payment",
    partyIdKey: "supplierId",
    partyQueryKey: "suppliers",
    capAmountToBalance: false,
  },
} as const;

export function VoucherDialog({
  open,
  onOpenChange,
  parties,
  sessionId,
  direction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parties: VoucherParty[];
  sessionId: number | null;
  direction: VoucherDirection;
}) {
  const copy = VOUCHER_COPY[direction];
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  const filtered = parties.filter((party) => party.name.includes(search));
  const selected = parties.find((party) => party.id === selectedId);
  const maxMillieme = selected ? Math.max(selected.balance_millieme, 0) : 0;

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        copy.command,
        {
          [copy.partyIdKey]: selectedId,
          amountMillieme: toMillieme(amount),
          method,
          notes: notes.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success(copy.successToast);
      await invalidate(["payments"], [copy.partyQueryKey], ["cash-summary"]);
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
      toast.error(copy.selectError);
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
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {copy.selectLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              dir="rtl"
              placeholder={copy.searchPlaceholder}
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
                  filtered.map((party) => (
                    <button
                      key={party.id}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-right text-sm transition-colors hover:bg-muted",
                        selectedId === party.id && "bg-primary/10 font-medium",
                      )}
                      onClick={() => {
                        setSelectedId(party.id);
                        setSearch(party.name);
                      }}
                    >
                      {party.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {selected && selected.balance_millieme > 0 && (
              <p className="text-sm text-orange-600">
                {copy.balanceLabel} {formatEGP(selected.balance_millieme)}
              </p>
            )}
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              {copy.amountLabel} <span className="text-destructive">*</span>
            </span>
            <Input
              dir="rtl"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max={
                copy.capAmountToBalance && maxMillieme > 0
                  ? (maxMillieme / 1000).toString()
                  : undefined
              }
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              {copy.methodLabel}
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
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
