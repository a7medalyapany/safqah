import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/modules/dashboard/components/DashboardStates";
import type { InvoiceSummary } from "@/modules/dashboard/types";
import { statusClassNames, statusLabels } from "@/modules/dashboard/utils";
import { SectionCard } from "@/shared/components/SectionCard";
import { formatEGP } from "@/shared/utils/money";

type RecentInvoicesPanelProps = {
  invoices: InvoiceSummary[];
  isLoading: boolean;
  isError: boolean;
  loadingFallback: ReactNode;
};

export function RecentInvoicesPanel({
  invoices,
  isLoading,
  isError,
  loadingFallback,
}: RecentInvoicesPanelProps) {
  return (
    <SectionCard
      title="آخر الفواتير"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sales">عرض كل الفواتير</Link>
        </Button>
      }
    >
      {isLoading ? (
        loadingFallback
      ) : isError ? (
        <ErrorState />
      ) : (
        <RecentInvoicesList invoices={invoices} />
      )}
    </SectionCard>
  );
}

function RecentInvoicesList({ invoices }: { invoices: InvoiceSummary[] }) {
  if (invoices.length === 0) {
    return <EmptyState className="h-auto min-h-24">لا توجد فواتير بعد</EmptyState>;
  }

  return (
    <div className="divide-y">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{invoice.invoice_number}</p>
            <p className="truncate text-sm text-muted-foreground">
              {invoice.customer_name || "عميل عام"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="font-semibold">{formatEGP(invoice.total_millieme)}</p>
            <Badge className={statusClassNames[invoice.status]}>
              {statusLabels[invoice.status]}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
