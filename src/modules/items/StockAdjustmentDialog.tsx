import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
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
import type { Item } from "@/modules/items/types";
import { parseAppError } from "@/modules/items/utils";
import { invoke } from "@/shared/utils/invoke";

type StockAdjustmentDialogProps = {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StockAdjustmentDialog({
  item,
  open,
  onOpenChange,
}: StockAdjustmentDialogProps) {
  const queryClient = useQueryClient();
  const [newQty, setNewQty] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open && item) {
      setNewQty(String(item.current_stock));
      setReason("");
    }
  }, [open, item]);

  const parsedNewQty = useMemo(() => {
    const trimmed = newQty.trim();
    if (trimmed === "") {
      return item?.current_stock ?? 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed)
      ? Math.max(parsed, 0)
      : (item?.current_stock ?? 0);
  }, [newQty, item]);

  const currentStock = item?.current_stock ?? 0;
  const delta = parsedNewQty - currentStock;

  const preview = useMemo(() => {
    if (!item) {
      return { label: "لا يوجد تغيير", tone: "text-muted-foreground" };
    }

    if (delta > 0) {
      return {
        label: `سيتم إضافة +${delta} قطعة`,
        tone: "text-emerald-700",
      };
    }

    if (delta < 0) {
      return {
        label: `سيتم خصم ${Math.abs(delta)} قطعة`,
        tone: "text-amber-700",
      };
    }

    return { label: "لا يوجد تغيير", tone: "text-muted-foreground" };
  }, [delta, item]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) {
        return null;
      }

      return invoke<Item>(
        "adjust_stock",
        {
          itemId: item.id,
          newQty: parsedNewQty,
          reason: reason.trim() ? reason.trim() : null,
        },
        { toast: false },
      );
    },
    onSuccess: async (updatedItem) => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["items-stats"] });
      const nextStock = updatedItem?.current_stock ?? parsedNewQty;
      toast.success(`تم تحديث المخزون — الرصيد الجديد: ${nextStock} قطعة`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(parseAppError(error).message_ar);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) {
      return;
    }

    if (parsedNewQty === currentStock) {
      toast.success(`تم تحديث المخزون — الرصيد الجديد: ${currentStock} قطعة`);
      onOpenChange(false);
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="text-right">
          <DialogTitle>{item?.name_ar ?? "تسوية جرد"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="space-y-2 text-right">
            <p className="text-sm text-muted-foreground">
              الكمية الحالية في النظام: {currentStock} قطعة
            </p>
          </div>

          <label className="space-y-2 text-right">
            <span className="block text-sm font-medium text-foreground">
              الكمية الفعلية *
            </span>
            <Input
              dir="rtl"
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              value={newQty}
              onChange={(event) => setNewQty(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-right">
            <span className="block text-sm font-medium text-foreground">
              سبب التسوية
            </span>
            <Input
              dir="rtl"
              value={reason}
              placeholder="مثال: كسر، تلف، خطأ في الجرد"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <p className={`text-sm ${preview.tone}`}>{preview.label}</p>

          <DialogFooter className="flex-row-reverse justify-start gap-2 bg-transparent p-0 pt-2">
            <Button
              type="submit"
              className="min-w-32"
              disabled={mutation.isPending || delta === 0}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              تأكيد التسوية
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
