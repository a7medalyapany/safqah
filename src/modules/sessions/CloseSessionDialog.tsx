import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseAppError } from "@/modules/items/utils";
import { formatEGP, toMillieme } from "@/shared/utils/money";
import { type Session, type SessionState, useSessionStore } from "@/store/sessionSlice";

type CloseSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
};

export function CloseSessionDialog({
  open,
  onOpenChange,
  session,
}: CloseSessionDialogProps) {
  const closeSession = useSessionStore((state: SessionState) => state.closeSession);
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [totalSalesMillieme, setTotalSalesMillieme] = useState(0);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !session) {
      return;
    }

    let isMounted = true;

    const loadSales = async () => {
      try {
        setIsLoadingSales(true);
        const total = await invoke<number>("get_session_sales_total_millieme", {
          sessionId: session.id,
        });

        if (isMounted) {
          setTotalSalesMillieme(total);
        }
      } catch (error) {
        if (isMounted) {
          toast.error(parseAppError(error).message_ar);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSales(false);
        }
      }
    };

    void loadSales();

    return () => {
      isMounted = false;
    };
  }, [open, session]);

  const handleSubmit = async () => {
    if (!session) {
      return;
    }

    if (closingCash.trim() === "") {
      toast.error("مبلغ إغلاق الخزينة مطلوب");
      return;
    }

    try {
      setIsSubmitting(true);
      await closeSession(toMillieme(closingCash), notes);
      toast.success("تم إغلاق الوردية بنجاح");
      setClosingCash("");
      setNotes("");
      onOpenChange(false);
    } catch (error) {
      toast.error(parseAppError(error).message_ar);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إغلاق الوردية</DialogTitle>
          <DialogDescription>
            راجع المبالغ قبل إغلاق الوردية الحالية.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">مبلغ فتح الخزينة</span>
            <span className="font-medium">
              {formatEGP(session?.opening_cash_millieme ?? 0)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">إجمالي المبيعات</span>
            <span className="font-medium">
              {isLoadingSales ? "جارٍ التحميل..." : formatEGP(totalSalesMillieme)}
            </span>
          </div>
        </div>

        <label className="space-y-2 text-right">
          <span className="block text-sm font-medium text-foreground">
            مبلغ إغلاق الخزينة
          </span>
          <Input
            dir="rtl"
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            value={closingCash}
            onChange={(event) => setClosingCash(event.target.value)}
          />
        </label>

        <label className="space-y-2 text-right">
          <span className="block text-sm font-medium text-foreground">ملاحظات</span>
          <textarea
            dir="rtl"
            className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !session}>
            إغلاق الوردية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
