import { useDeferredValue, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InvoiceDetailSheet } from "@/modules/sales/components/InvoiceDetailSheet";
import { InvoiceFilters } from "@/modules/sales/components/InvoiceFilters";
import { InvoiceTable } from "@/modules/sales/components/InvoiceTable";
import { SalesStatsGrid } from "@/modules/sales/components/SalesStatsGrid";
import { PAGE_SIZE } from "@/modules/sales/constants";
import {
  useInvoiceDetail,
  useInvoices,
  useInvoiceStats,
} from "@/modules/sales/hooks";

export default function SalesPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null,
  );

  const deferredCustomerSearch = useDeferredValue(customerSearch);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [dateFrom, dateTo, deferredCustomerSearch, status, paymentMethod]);

  const statsQuery = useInvoiceStats();
  const invoicesQuery = useInvoices({
    dateFrom,
    dateTo,
    customerSearch: deferredCustomerSearch,
    status,
    paymentMethod,
    visibleLimit,
  });
  const detailQuery = useInvoiceDetail(selectedInvoiceId);

  const stats = statsQuery.data ?? {
    total_count: 0,
    paid_count: 0,
    deferred_count: 0,
    total_sales_millieme: 0,
  };
  const invoices = invoicesQuery.data ?? [];
  const selectedInvoice = detailQuery.data ?? null;
  const hasMore = invoices.length >= visibleLimit;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          فواتير المبيعات
        </h1>
        <p className="text-sm text-muted-foreground">
          متابعة فواتير البيع، حالات السداد، والمديونيات المرتبطة بالعملاء.
        </p>
      </header>

      <SalesStatsGrid stats={stats} isLoading={statsQuery.isLoading} />

      <section className="space-y-4">
        <InvoiceFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          customerSearch={customerSearch}
          status={status}
          paymentMethod={paymentMethod}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onCustomerSearchChange={setCustomerSearch}
          onStatusChange={setStatus}
          onPaymentMethodChange={setPaymentMethod}
        />

        <InvoiceTable
          invoices={invoices}
          isLoading={invoicesQuery.isLoading}
          onSelectInvoice={setSelectedInvoiceId}
        />

        {hasMore ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}
              disabled={invoicesQuery.isFetching}
            >
              تحميل المزيد
            </Button>
          </div>
        ) : null}
      </section>

      <InvoiceDetailSheet
        open={selectedInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvoiceId(null);
          }
        }}
        invoice={selectedInvoice}
        isLoading={detailQuery.isLoading}
      />
    </div>
  );
}
