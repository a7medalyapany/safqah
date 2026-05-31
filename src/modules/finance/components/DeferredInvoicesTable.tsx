import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeferredInvoiceSummary } from "@/modules/finance/types";
import { relativeTime } from "@/modules/finance/utils";
import { formatEGP } from "@/shared/utils/money";
import { EmptyState, LoadingRows, TableCell, TableHead } from "./FinancePrimitives";

export function DeferredInvoicesTable({
  invoices,
  isLoading,
  onCollectPayment,
}: {
  invoices: DeferredInvoiceSummary[];
  isLoading: boolean;
  onCollectPayment: (invoice: DeferredInvoiceSummary) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>الفواتير الآجلة</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-muted/40 text-sm text-muted-foreground">
              <tr>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>المدفوع</TableHead>
                <TableHead>المتبقي</TableHead>
                <TableHead>منذ</TableHead>
                <TableHead>الإجراءات</TableHead>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={7} />
              ) : invoices.length === 0 ? (
                <EmptyState colSpan={7} message="لا توجد فواتير آجلة" />
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.invoice_id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="font-medium text-foreground">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{formatEGP(inv.total_millieme)}</TableCell>
                    <TableCell>{formatEGP(inv.paid_millieme)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-destructive">
                        {formatEGP(inv.remaining_millieme)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {relativeTime(inv.days_outstanding)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCollectPayment(inv)}
                      >
                        تسجيل دفعة
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

// ── CollectPaymentDialog ────────────────────────────────────────────────────
