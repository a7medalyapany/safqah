import type { Supplier } from "@/modules/parties/types";

import { VoucherDialog } from "./VoucherDialog";

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
  return (
    <VoucherDialog
      open={open}
      onOpenChange={onOpenChange}
      parties={suppliers}
      sessionId={sessionId}
      direction="out"
    />
  );
}
