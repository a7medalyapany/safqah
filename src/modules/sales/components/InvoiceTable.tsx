import { Eye, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paymentMethodLabels } from "@/modules/sales/constants";
import { StatusBadge } from "@/modules/sales/components/StatusBadge";
import type { InvoiceSummary } from "@/modules/sales/types";
import { getRemainingMillieme } from "@/modules/sales/utils";
import {
  EmptyState,
  LoadingRows,
  TableCell,
  TableHeadCell,
} from "@/shared/components/DataTable";
import { formatDate } from "@/shared/utils/date";
import { formatEGP } from "@/shared/utils/money";

export function InvoiceTable({
  invoices,
  isLoading,
  onSelectInvoice,
}: {
  invoices: InvoiceSummary[];
  isLoading: boolean;
  onSelectInvoice: (invoiceId: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>قائمة الفواتير</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40 text-sm text-muted-foreground">
              <tr>
                <TableHeadCell>رقم الفاتورة</TableHeadCell>
                <TableHeadCell>العميل</TableHeadCell>
                <TableHeadCell>الإجمالي</TableHeadCell>
                <TableHeadCell>المدفوع</TableHeadCell>
                <TableHeadCell>الآجل</TableHeadCell>
                <TableHeadCell>طريقة الدفع</TableHeadCell>
                <TableHeadCell>الحالة</TableHeadCell>
                <TableHeadCell>التاريخ</TableHeadCell>
                <TableHeadCell>الإجراءات</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows columns={9} />
              ) : invoices.length === 0 ? (
                <EmptyState
                  colSpan={9}
                  icon={<ReceiptText className="size-10 text-muted-foreground" />}
                  label="لا توجد فواتير"
                />
              ) : (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="font-medium text-foreground">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>{invoice.customer_name || "عميل عام"}</TableCell>
                    <TableCell>{formatEGP(invoice.total_millieme)}</TableCell>
                    <TableCell>{formatEGP(invoice.paid_millieme)}</TableCell>
                    <TableCell>{formatEGP(getRemainingMillieme(invoice))}</TableCell>
                    <TableCell>
                      {paymentMethodLabels[invoice.payment_method] ??
                        invoice.payment_method}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{formatDate(invoice.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onSelectInvoice(invoice.id)}
                        aria-label="عرض تفاصيل الفاتورة"
                      >
                        <Eye />
                      </Button>
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
