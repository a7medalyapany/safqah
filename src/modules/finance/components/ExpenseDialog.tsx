import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseAppError } from "@/modules/items/utils";
import type { ExpenseCategory } from "@/modules/finance/types";
import { invoke } from "@/shared/utils/invoke";
import { toMillieme } from "@/shared/utils/money";

export function ExpenseDialog({
  open,
  onOpenChange,
  categories,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  sessionId: number | null;
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      invoke(
        "create_expense",
        {
          amountMillieme: toMillieme(amount),
          categoryId: categoryId ? Number(categoryId) : null,
          description: description.trim() || null,
          sessionId,
        },
        { toast: false },
      ),
    onSuccess: async () => {
      toast.success("تم تسجيل المصروف بنجاح");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["cash-summary"] }),
      ]);
      setCategoryId("");
      setAmount("");
      setDescription("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>مصروف جديد</DialogTitle>
          <DialogDescription>تسجيل مصروف تشغيلي.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              نوع المصروف <span className="text-destructive">*</span>
            </span>
            <select
              dir="rtl"
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">اختر النوع</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              المبلغ <span className="text-destructive">*</span>
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
              وصف
            </span>
            <textarea
              dir="rtl"
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              حفظ
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

// ── DeferredInvoicesTable ────────────────────────────────────────────────────
