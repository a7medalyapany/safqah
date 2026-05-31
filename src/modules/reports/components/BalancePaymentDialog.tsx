import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { BalanceKind, BalanceRow } from "@/modules/reports/types";
import { invoke } from "@/shared/utils/invoke";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { useSessionStore } from "@/store/sessionSlice";
import { FilterField } from "./ReportPrimitives";

export function BalancePaymentDialog({
  kind,
  row,
  onOpenChange,
}: {
  kind: BalanceKind;
  row: BalanceRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const activeSession = useSessionStore((state) => state.activeSession);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const mutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error("No row selected");
      const command =
        kind === "customer"
          ? "record_customer_payment"
          : "record_supplier_payment";
      return invoke(
        command,
        {
          customerId: row.customer_id,
          supplierId: row.supplier_id,
          amountMillieme: toMillieme(amount),
          method,
          notes: null,
          sessionId: activeSession?.id ?? null,
        },
        { toast: false },
      );
    },
    onSuccess: () => {
      toast.success("تم تسجيل الدفعة");
      setAmount("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["report-balances", kind] });
      queryClient.invalidateQueries({
        queryKey: [kind === "customer" ? "customers" : "suppliers"],
      });
    },
    onError: () => toast.error("تعذر تسجيل الدفعة"),
  });

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>تسجيل دفعة</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.name} — الرصيد الحالي ${formatEGP(row.balance_millieme)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (toMillieme(amount) <= 0) {
              toast.error("المبلغ يجب أن يكون أكبر من صفر");
              return;
            }
            mutation.mutate();
          }}
        >
          <FilterField label="المبلغ">
            <Input
              dir="rtl"
              type="number"
              step="0.001"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FilterField>
          <FilterField label="طريقة الدفع">
            <select
              dir="rtl"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="cash">كاش</option>
              <option value="card">فيزا</option>
              <option value="bank">تحويل بنكي</option>
            </select>
          </FilterField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              تسجيل
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
