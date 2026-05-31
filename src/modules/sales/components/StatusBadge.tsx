import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabels } from "@/modules/sales/constants";
import type { InvoiceStatus } from "@/modules/sales/types";
import { getStatusTone } from "@/modules/sales/utils";

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="outline" className={cn(getStatusTone(status))}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}
