import type { Customer } from "@/modules/parties/types";

import { VoucherDialog } from "./VoucherDialog";

export function ReceiptVoucherDialog({
  open,
  onOpenChange,
  customers,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  sessionId: number | null;
}) {
  return (
    <VoucherDialog
      open={open}
      onOpenChange={onOpenChange}
      parties={customers}
      sessionId={sessionId}
      direction="in"
    />
  );
}
