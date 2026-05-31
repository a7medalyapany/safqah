import { useState } from "react";
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
import { toMillieme } from "@/shared/utils/money";
import { useAuthStore } from "@/store/authSlice";
import { type SessionState, useSessionStore } from "@/store/sessionSlice";

type OpenSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OpenSessionDialog({
  open,
  onOpenChange,
}: OpenSessionDialogProps) {
  const openSession = useSessionStore(
    (state: SessionState) => state.openSession,
  );
  const cashierId = useAuthStore((state) => state.user?.id ?? null);
  const [openingCash, setOpeningCash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (openingCash.trim() === "") {
      toast.error("مبلغ فتح الخزينة مطلوب");
      return;
    }

    try {
      setIsSubmitting(true);
      if (!cashierId) {
        toast.error("تعذر تحديد المستخدم الحالي");
        return;
      }

      await openSession(cashierId, toMillieme(openingCash));
      toast.success("تم فتح الوردية بنجاح");
      setOpeningCash("");
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
          <DialogTitle>بدء الوردية</DialogTitle>
          <DialogDescription>
            أدخل مبلغ فتح الخزينة قبل البدء في البيع.
          </DialogDescription>
        </DialogHeader>

        <label className="space-y-2 text-right">
          <span className="block text-sm font-medium text-foreground">
            مبلغ فتح الخزينة
          </span>
          <Input
            dir="rtl"
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            value={openingCash}
            onChange={(event) => setOpeningCash(event.target.value)}
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            بدء الوردية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
